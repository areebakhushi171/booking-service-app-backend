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

const conversationIdValidators = [
    param("id").trim().notEmpty().withMessage("Conversation ID is required"),
    validateRequest
];

const createConversationValidators = [
    body("serviceId").trim().notEmpty().withMessage("Property ID is required"),
    body("customerId").optional().trim().notEmpty(),
    validateRequest
];

const createMessageValidators = [
    body("content")
        .trim()
        .notEmpty()
        .withMessage("Message content is required"),
    validateRequest
];

module.exports = {
    conversationIdValidators,
    createConversationValidators,
    createMessageValidators
};
