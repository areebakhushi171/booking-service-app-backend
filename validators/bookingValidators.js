const { body, param, validationResult } = require("express-validator");

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

const bookingIdValidators = [
    param("id").trim().notEmpty().withMessage("Booking ID is required"),
    validateRequest
];

const createBookingValidators = [
    body("serviceId")
        .trim()
        .notEmpty()
        .withMessage("Property ID is required"),
    body("startDate")
        .isISO8601()
        .withMessage("Start date must be an ISO 8601 date")
        .bail()
        .toDate()
        .custom((value) => {
            if (value <= new Date()) {
                throw new Error("Booking start date must be in the future");
            }
            return true;
        }),
    body("endDate")
        .isISO8601()
        .withMessage("End date must be an ISO 8601 date")
        .bail()
        .toDate()
        .custom((value, { req }) => {
            if (value <= new Date(req.body.startDate)) {
                throw new Error("End date must be later than start date");
            }
            return true;
        }),
    validateRequest
];

const updateBookingStatusValidators = [
    body("status")
        .isIn(["CONFIRMED", "REJECTED", "CANCELLED", "COMPLETED"])
        .withMessage("Status is not supported"),
    validateRequest
];

module.exports = {
    bookingIdValidators,
    createBookingValidators,
    updateBookingStatusValidators
};
