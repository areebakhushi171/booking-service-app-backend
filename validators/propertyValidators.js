const { body, param, query, validationResult } = require("express-validator");

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: "Validation failed",
            errors: errors.array().map((error) => ({
                field: error.path,
                message: error.msg
            }))
        });
    }

    next();
};

const optionalString = (field, message) =>
    body(field)
        .optional()
        .trim()
        .notEmpty()
        .withMessage(message);

const isValidServicePrice = (value) => {
    if (typeof value !== "number" && typeof value !== "string") {
        return false;
    }

    const price = String(value).trim();
    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(price)) {
        return false;
    }

    const amount = Number(price);
    return Number.isFinite(amount) && amount >= 0.01 && amount <= 99999999.99;
};

const commonPropertyValidators = [
    optionalString("name", "Name cannot be empty"),
    optionalString("description", "Description cannot be empty"),
    optionalString("category", "Category cannot be empty"),
    body("duration")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Duration must be a positive whole number")
        .toInt(),
    body("imageUrl")
        .optional({ nullable: true, checkFalsy: true })
        .isURL()
        .withMessage("Image URL must be a valid URL"),
    body("gallery")
        .optional()
        .isArray()
        .withMessage("Gallery must be an array of strings"),
    body("gallery.*")
        .optional()
        .isString()
        .withMessage("Gallery items must be strings"),
    body("features")
        .optional()
        .isArray()
        .withMessage("Features must be an array of strings"),
    body("features.*")
        .optional()
        .isString()
        .withMessage("Feature items must be strings"),
    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean")
        .toBoolean(),
    optionalString("country", "Country cannot be empty"),
    optionalString("city", "City cannot be empty")
];

const createPropertyValidators = [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("description")
        .trim()
        .notEmpty()
        .withMessage("Description is required"),
    body("category").trim().notEmpty().withMessage("Category is required"),
    body("price")
        .exists()
        .withMessage("Price is required")
        .bail()
        .custom(isValidServicePrice)
        .withMessage("Price must be a positive number with up to 2 decimal places")
        .toFloat(),
    body("duration")
        .exists()
        .withMessage("Duration is required")
        .bail()
        .isInt({ min: 1 })
        .withMessage("Duration must be a positive whole number")
        .toInt(),
    body("country").trim().notEmpty().withMessage("Country is required"),
    body("city").trim().notEmpty().withMessage("City is required"),
    ...commonPropertyValidators,
    validateRequest
];

const updatePropertyValidators = [
    ...commonPropertyValidators,
    body("price")
        .optional()
        .custom(isValidServicePrice)
        .withMessage("Price must be a positive number with up to 2 decimal places")
        .toFloat(),
    body("removeGalleryIndexes")
        .optional()
        .isArray()
        .withMessage("removeGalleryIndexes must be an array of gallery indexes")
        .bail()
        .custom((indexes) =>
            indexes.every(
                (index) => Number.isInteger(index) && index >= 0
            )
        )
        .withMessage("Gallery indexes must be non-negative whole numbers"),
    body().custom((value, { req }) => {
        const requestBody = value ?? {};
        const fields = [
            "name",
            "description",
            "category",
            "price",
            "duration",
            "imageUrl",
            "gallery",
            "features",
            "isActive",
            "country",
            "city"
        ];

        const hasUploadedImages =
            req.files?.mainImage?.length > 0 ||
            req.files?.galleryImages?.length > 0;
        if (
            !fields.some((field) => requestBody[field] !== undefined) &&
            !requestBody.removeGalleryIndexes?.length &&
            !hasUploadedImages
        ) {
            throw new Error("Provide at least one field to update");
        }

        return true;
    }),
    validateRequest
];

const propertyIdValidators = [
    param("id").trim().notEmpty().withMessage("Property ID is required"),
    validateRequest
];

const ownerIdValidators = [
    param("ownerId").trim().notEmpty().withMessage("Owner ID is required"),
    validateRequest
];

const listPropertyValidators = [
    query("q").optional().trim().isString().withMessage("Search must be text"),
    query("country").optional().trim().notEmpty(),
    query("city").optional().trim().notEmpty(),
    query("category").optional().trim().notEmpty(),
    query("minPrice")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Minimum price must be a non-negative number")
        .toFloat(),
    query("maxPrice")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Maximum price must be a non-negative number")
        .toFloat(),
    query("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean")
        .toBoolean(),
    query("availableFrom")
        .optional()
        .isISO8601()
        .withMessage("availableFrom must be an ISO 8601 date")
        .toDate(),
    query("availableTo")
        .optional()
        .isISO8601()
        .withMessage("availableTo must be an ISO 8601 date")
        .toDate(),
    query("maxPrice").custom((value, { req }) => {
        if (
            value !== undefined &&
            req.query.minPrice !== undefined &&
            Number(value) < Number(req.query.minPrice)
        ) {
            throw new Error("Maximum price must be at least minimum price");
        }
        return true;
    }),
    query("availableTo").custom((value, { req }) => {
        if (
            value !== undefined &&
            req.query.availableFrom !== undefined &&
            new Date(value) <= new Date(req.query.availableFrom)
        ) {
            throw new Error("availableTo must be later than availableFrom");
        }
        if (value !== undefined && req.query.availableFrom === undefined) {
            throw new Error("availableFrom is required with availableTo");
        }
        return true;
    }),
    query("availableFrom").custom((value, { req }) => {
        if (value !== undefined && req.query.availableTo === undefined) {
            throw new Error("availableTo is required with availableFrom");
        }
        if (value !== undefined && new Date(value) <= new Date()) {
            throw new Error("Availability dates must be in the future");
        }
        return true;
    }),
    validateRequest
];

module.exports = {
    createPropertyValidators,
    updatePropertyValidators,
    propertyIdValidators,
    ownerIdValidators,
    listPropertyValidators
};
