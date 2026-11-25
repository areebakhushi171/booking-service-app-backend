
const express = require("express");
const authController = require("../controllers/authController");

const {
    signupValidators,
    loginValidators,
    handleValidationErrors
} = require("../validators/authValidators");

const router = express.Router();

// ==========================================
// BOOKEASE SIGNUP API
// ==========================================

router.post(
    "/signup",
    signupValidators,
    handleValidationErrors,
    authController.signup
);


// ==========================================
// BOOKEASE LOGIN API
// ==========================================

router.post(
    "/login",
    loginValidators,
    handleValidationErrors,
    authController.login
);

module.exports = router;
