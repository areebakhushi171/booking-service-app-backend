const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");
const {
    notificationIdValidators
} = require("../validators/notificationValidators");

const router = express.Router();

router.use(authMiddleware);
router.get("/unread-count", notificationController.getUnreadNotificationCount);
router.get("/unread", notificationController.listUnreadNotifications);
router.get("/", notificationController.listNotifications);
router.patch("/read-all", notificationController.markAllNotificationsRead);
router.patch(
    "/:id/read",
    notificationIdValidators,
    notificationController.markNotificationRead
);
router.delete(
    "/:id",
    notificationIdValidators,
    notificationController.deleteNotification
);

module.exports = router;
