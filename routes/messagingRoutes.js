const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const messagingController = require("../controllers/messagingController");
const {
    conversationIdValidators,
    createConversationValidators,
    createMessageValidators
} = require("../validators/messagingValidators");

const router = express.Router();

router.use(authMiddleware);
router.get("/unread-count", messagingController.getUnreadMessageCount);
router.get("/", messagingController.listConversations);
router.post(
    "/",
    createConversationValidators,
    messagingController.createOrGetConversation
);
router.get(
    "/:id/messages",
    conversationIdValidators,
    messagingController.getMessages
);
router.post(
    "/:id/messages",
    conversationIdValidators,
    createMessageValidators,
    messagingController.sendMessage
);
router.patch(
    "/:id/read",
    conversationIdValidators,
    messagingController.markMessagesRead
);

module.exports = router;
