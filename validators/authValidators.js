
const { body, validationResult } = require("express-validator");

// ==========================================
// BOOKEASE SIGNUP VALIDATIONS
// ==========================================

const signupValidators = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .bail()
        .isLength({ min: 2 })
        .withMessage("Name must be at least 2 characters")
        .bail()
        .matches(/^[a-zA-Z\s.'-]+$/)
        .withMessage("Name should only contain letters and spaces"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email address is required")
        .bail()
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
        .withMessage("Please enter a valid email address")
        .bail()
        .customSanitizer((value) => value.toLowerCase()),

    body("phone")
        .trim()
        .notEmpty()
        .withMessage("Phone number is required")
        .bail()
        .custom((value) => {
            const cleaned = value.replace(/[\s-]/g, "");

            if (!/^\+?[0-9]{10,14}$/.test(cleaned)) {
                throw new Error(
                    "Please enter a valid phone number (e.g. +92 300 1234567)"
                );
            }

            return true;
        })
        .customSanitizer((value) => value.replace(/[\s-]/g, "")),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .bail()
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters"),

    body("role")
        .notEmpty()
        .withMessage("User role is required")
        .bail()
        .isIn(["customer", "provider"])
        .withMessage("Role must be customer or provider"),

    body("businessName")
        .if(body("role").equals("provider"))
        .trim()
        .notEmpty()
        .withMessage("Business / Service Name is required"),

    body("businessCategory")
        .if(body("role").equals("provider"))
        .trim()
        .notEmpty()
        .withMessage("Business category is required")
        .bail()
        .isIn([
            "salon",
            "wellness",
            "home",
            "tutoring",
            "health",
            "auto"
        ])
        .withMessage("Please select a valid business category")
];


// ==========================================
// BOOKEASE LOGIN VALIDATIONS
// ==========================================

const loginValidators = [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email address is required")
        .bail()
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
        .withMessage("Please enter a valid email address")
        .bail()
        .customSanitizer((value) => value.toLowerCase()),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
];


// ==========================================
// BOOKEASE PROFILE UPDATE VALIDATIONS
// ==========================================

const profileUpdateValidators = [
    body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Full name cannot be empty")
        .bail()
        .isLength({ min: 2 })
        .withMessage("Name must be at least 2 characters")
        .bail()
        .matches(/^[a-zA-Z\s.'-]+$/)
        .withMessage("Name should only contain letters and spaces"),

    body("email")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Email cannot be empty")
        .bail()
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
        .withMessage("Please enter a valid email address")
        .bail()
        .customSanitizer((value) => value.toLowerCase()),

    body("phone")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Phone number cannot be empty")
        .bail()
        .custom((value) => {
            const cleaned = value.replace(/[\s-]/g, "");

            if (!/^\+?[0-9]{10,14}$/.test(cleaned)) {
                throw new Error("Please enter a valid phone number");
            }

            return true;
        })
        .customSanitizer((value) => value.replace(/[\s-]/g, "")),

    body("businessName")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Business name cannot be empty"),

    body("businessCategory")
        .optional()
        .trim()
        .isIn([
            "salon",
            "wellness",
            "home",
            "tutoring",
            "health",
            "auto"
        ])
        .withMessage("Please select a valid business category")
];


// ==========================================
// BOOKEASE CHANGE PASSWORD VALIDATIONS
// ==========================================

const changePasswordValidators = [
    body("currentPassword")
        .notEmpty()
        .withMessage("Current password is required"),

    body("newPassword")
        .notEmpty()
        .withMessage("New password is required")
        .bail()
        .isLength({ min: 8 })
        .withMessage("New password must be at least 8 characters"),

    body("confirmPassword")
        .notEmpty()
        .withMessage("Please confirm your new password")
        .bail()
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error("New passwords do not match");
            }

            return true;
        })
];


// ==========================================
// COMMON VALIDATION ERROR HANDLER
// ==========================================

const handleValidationErrors = (req, res, next) => {
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


// ==========================================
// EXPORT VALIDATIONS
// ==========================================

module.exports = {
    signupValidators,
    loginValidators,
    profileUpdateValidators,
    changePasswordValidators,
    handleValidationErrors
};
