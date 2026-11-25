const prisma = require("../config/database");

let io;
const socketDebugEnabled = () => process.env.SOCKET_DEBUG === "true";

const userRoom = (userId) => `user:${userId}`;
const conversationRoom = (conversationId) =>
    `conversation:${conversationId}`;

const setSocketServer = (socketServer) => {
    io = socketServer;
};

const emitToUser = (userId, event, payload) => {
    if (!io || !userId) {
        if (socketDebugEnabled()) {
            console.warn("[Socket.IO] skipped emission", {
                event,
                userId: userId || null,
                serverAttached: Boolean(io)
            });
        }
        return;
    }
    if (socketDebugEnabled()) {
        console.info("[Socket.IO] emitting", { event, userId });
    }
    io.to(userRoom(userId)).emit(event, payload);
};

const emitToUsers = (userIds, event, payload) => {
    for (const userId of new Set(userIds.filter(Boolean))) {
        emitToUser(userId, event, payload);
    }
};

const emitToAllUsers = (event, payload) => {
    if (!io) {
        if (socketDebugEnabled()) {
            console.warn("[Socket.IO] skipped broadcast", {
                event,
                serverAttached: false
            });
        }
        return;
    }
    if (socketDebugEnabled()) {
        console.info("[Socket.IO] broadcasting to authenticated clients", {
            event
        });
    }
    io.emit(event, payload);
};

const emitNotification = async (notification) => {
    if (!io || !notification) return;

    const unreadCount = await prisma.notification.count({
        where: {
            userId: notification.userId,
            readAt: null
        }
    });

    emitToUser(notification.userId, "notification:new", notification);
    emitToUser(notification.userId, "notification:unread_count_updated", {
        unreadCount
    });
};

const emitNotificationCount = async (userId, event, payload = {}) => {
    if (!io) return;

    const unreadCount = await prisma.notification.count({
        where: { userId, readAt: null }
    });

    emitToUser(userId, event, { ...payload, unreadCount });
    emitToUser(userId, "notification:unread_count_updated", { unreadCount });
};

module.exports = {
    setSocketServer,
    emitToUser,
    emitToUsers,
    emitToAllUsers,
    emitNotification,
    emitNotificationCount,
    userRoom,
    conversationRoom
};
