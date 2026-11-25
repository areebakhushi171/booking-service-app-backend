const { randomUUID } = require("node:crypto");
const cloudinary = require("../config/cloudinary");
const uploadDebugEnabled = () => process.env.UPLOAD_DEBUG === "true";

class CloudinaryError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "CloudinaryError";
    }
}

const uploadImage = (buffer, folder, publicIdPrefix) => {
    return new Promise((resolve, reject) => {
        const startedAt = process.hrtime.bigint();
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: `${publicIdPrefix}-${randomUUID()}`,
                upload_preset: "bookease_images",
                resource_type: "image",
                overwrite: false,
                unique_filename: false,
                allowed_formats: ["jpg", "jpeg", "png", "webp"],
                max_bytes: 5 * 1024 * 1024
            },
            (error, result) => {
                const elapsedMs =
                    Number(process.hrtime.bigint() - startedAt) / 1e6;
                if (error) {
                    if (uploadDebugEnabled()) {
                        console.warn("[Cloudinary] image upload failed", {
                            folder,
                            fileSizeBytes: buffer.length,
                            elapsedMs
                        });
                    }
                    reject(new CloudinaryError("Cloudinary image upload failed", { cause: error }));
                    return;
                }

                if (!result?.secure_url || !result.public_id) {
                    if (uploadDebugEnabled()) {
                        console.warn("[Cloudinary] incomplete upload result", {
                            folder,
                            fileSizeBytes: buffer.length,
                            elapsedMs
                        });
                    }
                    reject(new CloudinaryError("Cloudinary returned incomplete image details"));
                    return;
                }

                if (uploadDebugEnabled()) {
                    console.info("[Cloudinary] image upload completed", {
                        folder,
                        fileSizeBytes: buffer.length,
                        elapsedMs
                    });
                }
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id
                });
            }
        );

        stream.end(buffer);
    });
};

const deleteImage = async (publicId) => {
    if (!publicId) {
        return;
    }

    let result;

    try {
        result = await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true
        });
    } catch (error) {
        throw new CloudinaryError("Cloudinary image deletion failed", { cause: error });
    }

    if (result?.result !== "ok" && result?.result !== "not found") {
        throw new CloudinaryError("Cloudinary did not confirm image deletion");
    }
};

const cleanupUploadedImages = async (images) => {
    const results = await Promise.allSettled(
        images.map((image) => deleteImage(image.publicId))
    );
    const failures = results.filter((result) => result.status === "rejected");

    if (failures.length > 0) {
        console.error(
            "Unable to clean up uploaded Cloudinary images:",
            failures.map((failure) => failure.reason)
        );
    }

    return failures.length === 0;
};

const uploadImages = async (files, folder, publicIdPrefix) => {
    const uploaded = [];

    try {
        for (const file of files) {
            uploaded.push(
                await uploadImage(file.buffer, folder, publicIdPrefix)
            );
        }

        return uploaded;
    } catch (error) {
        const cleaned = await cleanupUploadedImages(uploaded);
        if (!cleaned) {
            error.cleanupFailed = true;
        }
        throw error;
    }
};

module.exports = {
    CloudinaryError,
    uploadImage,
    uploadImages,
    deleteImage,
    cleanupUploadedImages
};
