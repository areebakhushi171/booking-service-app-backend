const prisma = require("../config/database");
const realtimeService = require("./realtimeService");

const notificationSelect = {
    id: true,
    title: true,
    message: true,
    type: true,
    data: true,
    createdAt: true,
    readAt: true
};

const publishNotificationChange = async (userId, event, payload) => {
    try {
        await realtimeService.emitNotificationCount(userId, event, payload);
    } catch (error) {
        console.error("Notification realtime update error:", error);
    }
};

const listNotifications = (userId, unreadOnly = false) => {
    return prisma.notification.findMany({
        where: {
            userId,
            ...(unreadOnly && { readAt: null })
        },
        select: notificationSelect,
        orderBy: { createdAt: "desc" }
    });
};

const markNotificationRead = async (userId, notificationId) => {
    const readAt = new Date();
    const result = await prisma.notification.updateMany({
        where: {
            id: notificationId,
            userId
        },
        data: { readAt }
    });

    if (result.count > 0) {
        await publishNotificationChange(userId, "notification:read", {
            notificationId,
            readAt
        });
    }

    return result.count > 0;
};

const markAllNotificationsRead = async (userId) => {
    const readAt = new Date();
    const result = await prisma.notification.updateMany({
        where: {
            userId,
            readAt: null
        },
        data: { readAt }
    });

    if (result.count > 0) {
        await publishNotificationChange(userId, "notification:read", {
            all: true,
            readAt
        });
    }

    return result.count;
};

const deleteNotification = async (userId, notificationId) => {
    const result = await prisma.notification.deleteMany({
        where: {
            id: notificationId,
            userId
        }
    });

    if (result.count > 0) {
        await publishNotificationChange(userId, "notification:deleted", {
            notificationId
        });
    }

    return result.count > 0;
};

const getUnreadNotificationCount = (userId) => {
    return prisma.notification.count({
        where: {
            userId,
            readAt: null
        }
    });
};

module.exports = {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    getUnreadNotificationCount
};
