
const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const userController = require("../controllers/userController");
const { uploadAvatar } = require("../middleware/imageUploadMiddleware");

const {
    profileUpdateValidators,
    changePasswordValidators,
    handleValidationErrors
} = require("../validators/authValidators");

const router = express.Router();

// ==========================================
// GET LOGGED-IN USER PROFILE
// ==========================================

router.get("/me", authMiddleware, userController.getProfile);
router.post(
    "/me/avatar",
    authMiddleware,
    authorizeRoles("customer", "provider"),
    uploadAvatar,
    userController.uploadAvatar
);
router.delete(
    "/me/avatar",
    authMiddleware,
    authorizeRoles("customer", "provider"),
    userController.deleteAvatar
);


// ==========================================
// UPDATE LOGGED-IN USER PROFILE
// ==========================================

router.patch(
    "/me",
    authMiddleware,
    profileUpdateValidators,
    handleValidationErrors,
    userController.updateProfile
);


// ==========================================
// CHANGE LOGGED-IN USER PASSWORD
// ==========================================

router.patch(
    "/change-password",
    authMiddleware,
    changePasswordValidators,
    handleValidationErrors,
    userController.changePassword
);

module.exports = router;
