const notificationService = require("../services/notificationManagementService");

const listNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.listNotifications(
            req.user.userId
        );

        return res.status(200).json({
            message: "Notifications fetched successfully!",
            notifications
        });
    } catch (error) {
        console.error("List Notifications Error:", error);

        return res.status(500).json({
            message: "Unable to fetch notifications"
        });
    }
};

const listUnreadNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.listNotifications(
            req.user.userId,
            true
        );

        return res.status(200).json({
            message: "Unread notifications fetched successfully!",
            notifications
        });
    } catch (error) {
        console.error("List Unread Notifications Error:", error);

        return res.status(500).json({
            message: "Unable to fetch unread notifications"
        });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const updated = await notificationService.markNotificationRead(
            req.user.userId,
            req.params.id
        );

        if (!updated) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            message: "Notification marked as read"
        });
    } catch (error) {
        console.error("Mark Notification Read Error:", error);

        return res.status(500).json({
            message: "Unable to mark notification as read"
        });
    }
};

const markAllNotificationsRead = async (req, res) => {
    try {
        const updatedCount =
            await notificationService.markAllNotificationsRead(
                req.user.userId
            );

        return res.status(200).json({
            message: "All notifications marked as read",
            updatedCount
        });
    } catch (error) {
        console.error("Mark All Notifications Read Error:", error);

        return res.status(500).json({
            message: "Unable to mark notifications as read"
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const deleted = await notificationService.deleteNotification(
            req.user.userId,
            req.params.id
        );

        if (!deleted) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        return res.status(200).json({
            message: "Notification deleted successfully!"
        });
    } catch (error) {
        console.error("Delete Notification Error:", error);

        return res.status(500).json({
            message: "Unable to delete notification"
        });
    }
};

const getUnreadNotificationCount = async (req, res) => {
    try {
        const count = await notificationService.getUnreadNotificationCount(
            req.user.userId
        );

        return res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error("Unread Notification Count Error:", error);

        return res.status(500).json({
            message: "Unable to fetch unread notification count"
        });
    }
};

module.exports = {
    listNotifications,
    listUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    getUnreadNotificationCount
};
