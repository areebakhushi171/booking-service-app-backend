const path = require("node:path");
const multer = require("multer");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const uploadDebugEnabled = () => process.env.UPLOAD_DEBUG === "true";
const allowedTypes = new Map([
    ["image/jpeg", new Set([".jpg", ".jpeg"])],
    ["image/png", new Set([".png"])],
    ["image/webp", new Set([".webp"])]
]);

const imageFormatError = (message) => {
    const error = new Error(message);
    error.code = "INVALID_IMAGE_FORMAT";
    return error;
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_IMAGE_SIZE,
        files: 6,
        fields: 30,
        parts: 40
    },
    fileFilter: (req, file, callback) => {
        const extensions = allowedTypes.get(file.mimetype);
        const extension = path.extname(file.originalname).toLowerCase();

        if (!extensions || !extensions.has(extension)) {
            callback(
                imageFormatError(
                    "Only matching JPG, JPEG, PNG, and WEBP image files are allowed"
                )
            );
            return;
        }

        callback(null, true);
    }
});

const formatMatchesBuffer = (file) => {
    const buffer = file.buffer;
    const mimeType = file.mimetype;

    if (
        mimeType === "image/jpeg" &&
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return true;
    }

    if (
        mimeType === "image/png" &&
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        )
    ) {
        return true;
    }

    return (
        mimeType === "image/webp" &&
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    );
};

const getFiles = (req) => {
    if (req.file) {
        return [req.file];
    }

    return Object.values(req.files ?? {}).flat();
};

const logUploadDiagnostics = (event, req, files, extra = {}) => {
    if (!uploadDebugEnabled()) return;

    console.info("[Upload]", {
        event,
        method: req.method,
        route: `${req.baseUrl ?? ""}${req.route?.path ?? ""}`,
        fileCount: files.length,
        fileSizesBytes: files.map((file) => file.size ?? file.buffer?.length ?? 0),
        elapsedMs: req.uploadStartedAt
            ? Number(process.hrtime.bigint() - req.uploadStartedAt) / 1e6
            : 0,
        ...extra
    });
};

const sendUploadError = (error, res) => {
    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
            message: "Each image must be 5 MB or smaller"
        });
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
        const message =
            error.field === "galleryImages"
                ? "You can upload at most 5 gallery images"
                : `Unexpected or duplicate image field: ${error.field ?? "unknown"}`;
        return res.status(400).json({ message });
    }

    if (error.code === "INVALID_IMAGE_FORMAT") {
        return res.status(400).json({ message: error.message });
    }

    console.error("Multipart image validation failed:", error);
    return res.status(400).json({
        message: "Invalid multipart image upload"
    });
};

const runUpload = (handler) => (req, res, next) => {
    req.uploadStartedAt = process.hrtime.bigint();
    logUploadDiagnostics("started", req, [], {
        contentLengthBytes: Number(req.headers["content-length"]) || null
    });

    handler(req, res, (error) => {
        const files = getFiles(req);
        if (error) {
            const disconnected =
                req.aborted ||
                req.destroyed ||
                res.destroyed ||
                !res.writable ||
                res.headersSent ||
                error.message === "Request aborted" ||
                error.message === "Request closed";
            if (disconnected) {
                logUploadDiagnostics("client-disconnected", req, files, {
                    errorCode: error.code ?? null
                });
                return;
            }

            logUploadDiagnostics("rejected", req, files, {
                errorCode: error.code ?? null
            });
            return sendUploadError(error, res);
        }

        const invalidFile = files.find(
            (file) => !formatMatchesBuffer(file)
        );

        if (invalidFile) {
            if (
                req.aborted ||
                req.destroyed ||
                res.destroyed ||
                !res.writable ||
                res.headersSent
            ) {
                logUploadDiagnostics("client-disconnected", req, files, {
                    errorCode: "INVALID_IMAGE_FORMAT"
                });
                return;
            }
            logUploadDiagnostics("rejected", req, files, {
                errorCode: "INVALID_IMAGE_FORMAT"
            });
            return res.status(400).json({
                message: "Image file contents do not match an allowed image format"
            });
        }

        logUploadDiagnostics("parsed", req, files);
        return next();
    });
};

const uploadAvatar = runUpload(upload.single("avatar"));
const uploadServiceImages = runUpload(
    upload.fields([
        { name: "mainImage", maxCount: 1 },
        { name: "galleryImages", maxCount: 5 }
    ])
);

const parseMultipartArrays = (req, res, next) => {
    for (const field of ["gallery", "features", "removeGalleryIndexes"]) {
        if (typeof req.body?.[field] !== "string") {
            continue;
        }

        try {
            const parsed = JSON.parse(req.body[field]);
            if (!Array.isArray(parsed)) {
                throw new Error("Expected a JSON array");
            }
            req.body[field] = parsed;
        } catch {
            return res.status(400).json({
                message: `${field} must be a JSON array`
            });
        }
    }

    next();
};

module.exports = {
    uploadAvatar,
    uploadServiceImages,
    parseMultipartArrays
};
