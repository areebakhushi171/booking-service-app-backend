const userService = require("../services/userService");
const { CloudinaryError } = require("../utils/imageStorage");

const getProfile = async (req, res) => {
    try {
        const user = await userService.getProfile(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Profile fetched successfully!",
            user
        });
    } catch (error) {
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            message: "Unable to fetch profile"
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const result = await userService.updateProfile(
            req.user.userId,
            req.user.role,
            req.body
        );

        if (result.status === "no-fields") {
            return res.status(400).json({
                message: "Please provide at least one field to update"
            });
        }

        if (result.status === "email-conflict") {
            return res.status(409).json({
                message: "Email is already registered"
            });
        }

        if (result.status === "business-details-forbidden") {
            return res.status(403).json({
                message: "Only providers can update business details"
            });
        }

        return res.status(200).json({
            message: "Profile updated successfully!",
            user: result.user
        });
    } catch (error) {
        console.error("Update Profile Error:", error);

        if (error.code === "P2002") {
            return res.status(409).json({
                message: "Email is already registered"
            });
        }

        return res.status(500).json({
            message: "Unable to update profile"
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const result = await userService.changePassword(
            req.user.userId,
            currentPassword,
            newPassword
        );

        if (result.status === "not-found") {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (result.status === "incorrect-current-password") {
            return res.status(401).json({
                message: "Current password is incorrect"
            });
        }

        if (result.status === "same-password") {
            return res.status(400).json({
                message: "New password must be different from current password"
            });
        }

        return res.status(200).json({
            message: "Password changed successfully!"
        });
    } catch (error) {
        console.error("Change Password Error:", error);

        return res.status(500).json({
            message: "Unable to change password"
        });
    }
};

const uploadAvatar = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            message: "An avatar image is required in the avatar field"
        });
    }

    try {
        const result = await userService.uploadAvatar(
            req.user.userId,
            req.file
        );

        if (result.status === "not-found") {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Profile image uploaded successfully!",
            user: result.user,
            ...(result.cleanupWarning && {
                warning: "The previous profile image could not be deleted or had no stored Cloudinary public ID"
            })
        });
    } catch (error) {
        console.error("Upload Avatar Error:", error);

        if (error instanceof CloudinaryError) {
            return res.status(502).json({
                message: "Unable to upload profile image to Cloudinary"
            });
        }

        return res.status(500).json({
            message: error.imageCleanupFailed
                ? "Unable to save profile image; uploaded image cleanup may be incomplete"
                : "Unable to save profile image"
        });
    }
};

const deleteAvatar = async (req, res) => {
    try {
        const result = await userService.deleteAvatar(req.user.userId);

        if (result.status === "not-found") {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (result.status === "cloudinary-failed") {
            return res.status(502).json({
                message: "Cloudinary could not delete the profile image; the database reference was preserved"
            });
        }

        return res.status(200).json({
            message: "Profile image removed successfully!",
            user: result.user,
            ...(result.cleanupWarning && {
                warning: "The previous image had no stored Cloudinary public ID, so its remote asset could not be deleted"
            })
        });
    } catch (error) {
        console.error("Delete Avatar Error:", error);

        return res.status(500).json({
            message: error.imageStateRecoveryFailed
                ? "Image deletion failed and restoring the database reference also failed"
                : "Unable to remove profile image"
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAvatar
};
