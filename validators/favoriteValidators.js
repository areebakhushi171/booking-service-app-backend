const { param, validationResult } = require("express-validator");

const favoritePropertyIdValidators = [
    param("propertyId")
        .trim()
        .notEmpty()
        .withMessage("Property ID is required"),
    (req, res, next) => {
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
    }
];

module.exports = {
    favoritePropertyIdValidators
};
