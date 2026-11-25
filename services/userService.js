const prisma = require("../config/database");
const { comparePassword, hashPassword } = require("../utils/passwordUtils");
const {
    CloudinaryError,
    uploadImage,
    deleteImage
} = require("../utils/imageStorage");

const profileFields = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    avatarUrl: true,
    avatarPublicId: true,
    businessName: true,
    businessCategory: true,
    notificationsEnabled: true,
    darkMode: true,
    createdAt: true,
    updatedAt: true
};

const uploadAvatar = async (userId, file) => {
    const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            avatarUrl: true,
            avatarPublicId: true
        }
    });

    if (!existingUser) {
        return { status: "not-found" };
    }

    const uploaded = await uploadImage(
        file.buffer,
        "bookease/profiles",
        `user-${userId}`
    );

    let user;
    try {
        user = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: uploaded.url,
                avatarPublicId: uploaded.publicId
            },
            select: profileFields
        });
    } catch (error) {
        try {
            await deleteImage(uploaded.publicId);
        } catch (cleanupError) {
            console.error(
                "Unable to clean up uploaded avatar after database failure:",
                cleanupError
            );
            error.imageCleanupFailed = true;
        }
        throw error;
    }

    let cleanupWarning = Boolean(
        existingUser.avatarUrl && !existingUser.avatarPublicId
    );
    if (existingUser.avatarPublicId) {
        try {
            await deleteImage(existingUser.avatarPublicId);
        } catch (error) {
            cleanupWarning = true;
            console.error("Unable to delete replaced profile image:", error);
        }
    }

    return {
        status: "updated",
        user,
        cleanupWarning
    };
};

const deleteAvatar = async (userId) => {
    const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            avatarUrl: true,
            avatarPublicId: true
        }
    });

    if (!existingUser) {
        return { status: "not-found" };
    }

    if (!existingUser.avatarPublicId) {
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                avatarUrl: null,
                avatarPublicId: null
            },
            select: profileFields
        });
        return {
            status: "deleted",
            user,
            cleanupWarning: Boolean(existingUser.avatarUrl)
        };
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            avatarUrl: null,
            avatarPublicId: null
        },
        select: profileFields
    });

    try {
        await deleteImage(existingUser.avatarPublicId);
    } catch (error) {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    avatarUrl: existingUser.avatarUrl,
                    avatarPublicId: existingUser.avatarPublicId
                }
            });
        } catch (restoreError) {
            console.error("Unable to restore profile image reference:", restoreError);
            error.imageStateRecoveryFailed = true;
        }

        if (error.imageStateRecoveryFailed) {
            throw error;
        }

        if (error instanceof CloudinaryError) {
            return { status: "cloudinary-failed" };
        }
        throw error;
    }

    return { status: "deleted", user };
};

const getProfile = (userId) => {
    return prisma.user.findUnique({
        where: { id: userId },
        select: profileFields
    });
};

const updateProfile = async (userId, role, fields) => {
    const {
        name,
        email,
        phone,
        businessName,
        businessCategory
    } = fields;

    if (
        name === undefined &&
        email === undefined &&
        phone === undefined &&
        businessName === undefined &&
        businessCategory === undefined
    ) {
        return { status: "no-fields" };
    }

    if (email !== undefined) {
        const existingUser = await prisma.user.findFirst({
            where: {
                email,
                NOT: { id: userId }
            }
        });

        if (existingUser) {
            return { status: "email-conflict" };
        }
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    if (role === "provider") {
        if (businessName !== undefined) {
            updateData.businessName = businessName;
        }

        if (businessCategory !== undefined) {
            updateData.businessCategory = businessCategory;
        }
    } else if (
        businessName !== undefined ||
        businessCategory !== undefined
    ) {
        return { status: "business-details-forbidden" };
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: profileFields
    });

    return { status: "updated", user };
};

const changePassword = async (userId, currentPassword, newPassword) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            passwordHash: true
        }
    });

    if (!user) {
        return { status: "not-found" };
    }

    if (!(await comparePassword(currentPassword, user.passwordHash))) {
        return { status: "incorrect-current-password" };
    }

    if (await comparePassword(newPassword, user.passwordHash)) {
        return { status: "same-password" };
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash }
    });

    return { status: "changed" };
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    uploadAvatar,
    deleteAvatar
};
