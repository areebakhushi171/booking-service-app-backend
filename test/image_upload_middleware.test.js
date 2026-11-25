const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const { once } = require("node:events");
const {
    uploadAvatar,
    uploadServiceImages
} = require("../middleware/imageUploadMiddleware");
const cloudinary = require("../config/cloudinary");
const { CloudinaryError, uploadImage } = require("../utils/imageStorage");

const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
]);

const multipartBody = (files, boundary = "bookease-test-boundary") => {
    const chunks = [];
    for (const file of files) {
        chunks.push(Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\n` +
            `Content-Type: ${file.type}\r\n\r\n`
        ));
        chunks.push(file.bytes);
        chunks.push(Buffer.from("\r\n"));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return { boundary, body: Buffer.concat(chunks) };
};

const imageFile = (field, name = "image.png", bytes = pngSignature, type = "image/png") =>
    ({ field, name, bytes, type });

const createUploadServer = async () => {
    const app = express();
    app.post("/avatar", uploadAvatar, (req, res) =>
        res.json({ filename: req.file.originalname, size: req.file.size })
    );
    app.post("/service", uploadServiceImages, (req, res) =>
        res.json({
            files: Object.fromEntries(
                Object.entries(req.files ?? {}).map(([field, files]) => [
                    field,
                    files.map(({ originalname, size }) => ({ originalname, size }))
                ])
            )
        })
    );
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return server;
};

const postMultipart = async (server, path, files) => {
    const { boundary, body } = multipartBody(files);
    const address = server.address();
    return fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: "POST",
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        body
    });
};

test("avatar and service upload routes accept the configured Multer fields", async (t) => {
    const server = await createUploadServer();
    t.after(() => new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
    ));

    const avatar = await postMultipart(server, "/avatar", [
        imageFile("avatar", "avatar.png")
    ]);
    assert.equal(avatar.status, 200);

    for (const files of [
        [imageFile("mainImage")],
        Array.from({ length: 5 }, (_, i) =>
            imageFile("galleryImages", `gallery-${i}.png`)
        ),
        [
            imageFile("mainImage", "cover.png"),
            ...Array.from({ length: 5 }, (_, i) =>
                imageFile("galleryImages", `gallery-${i}.png`)
            )
        ]
    ]) {
        const response = await postMultipart(server, "/service", files);
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.deepEqual(Object.keys(result.files).sort(),
            [...new Set(files.map((file) => file.field))].sort());
    }
});

test("unsupported and unexpected image fields return a client validation error", async (t) => {
    const server = await createUploadServer();
    t.after(() => new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
    ));

    const unsupported = await postMultipart(server, "/service", [
        imageFile("mainImage", "animated.gif", Buffer.from("GIF89a"), "image/gif")
    ]);
    assert.equal(unsupported.status, 400);

    const alias = await postMultipart(server, "/service", [
        imageFile("image", "cover.png")
    ]);
    assert.equal(alias.status, 400);
});

test("avatar upload accepts exactly 5 MiB and rejects a larger image", async (t) => {
    const server = await createUploadServer();
    t.after(() => new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve())
    ));

    const exactSize = Buffer.alloc(5 * 1024 * 1024);
    pngSignature.copy(exactSize);
    const accepted = await postMultipart(server, "/avatar", [
        imageFile("avatar", "large.png", exactSize)
    ]);
    assert.equal(accepted.status, 200);

    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1);
    pngSignature.copy(tooLarge);
    const rejected = await postMultipart(server, "/avatar", [
        imageFile("avatar", "too-large.png", tooLarge)
    ]);
    assert.equal(rejected.status, 413);
});

test("Cloudinary image upload success and failure are handled", async (t) => {
    const originalUploadStream = cloudinary.uploader.upload_stream;
    t.after(() => {
        cloudinary.uploader.upload_stream = originalUploadStream;
    });

    cloudinary.uploader.upload_stream = (_options, callback) => ({
        end() {
            callback(null, {
                secure_url: "https://images.example.test/service.png",
                public_id: "bookease/test-image"
            });
        }
    });
    const uploaded = await uploadImage(pngSignature, "bookease/test", "test");
    assert.equal(uploaded.publicId, "bookease/test-image");

    cloudinary.uploader.upload_stream = (_options, callback) => ({
        end() {
            callback(new Error("mock Cloudinary failure"));
        }
    });
    await assert.rejects(
        uploadImage(pngSignature, "bookease/test", "test"),
        CloudinaryError
    );
});
