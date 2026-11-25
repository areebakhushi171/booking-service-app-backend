const messagingService = require("../services/messagingService");

const sendConversationError = (res, status) => {
    if (status === "property-not-found" || status === "customer-not-found") {
        return res.status(404).json({
            message: "Property or customer not found"
        });
    }

    if (status === "not-owner" || status === "forbidden") {
        return res.status(403).json({
            message: "You are not authorized to start this conversation"
        });
    }

    if (status === "self-conversation") {
        return res.status(400).json({
            message: "You cannot start a conversation with yourself"
        });
    }

    if (status === "customer-required") {
        return res.status(400).json({
            message: "Customer ID is required for a provider"
        });
    }

    return null;
};

const createOrGetConversation = async (req, res) => {
    try {
        const result = await messagingService.createOrGetConversation(
            req.user,
            req.body
        );
        const errorResponse = sendConversationError(res, result.status);

        if (errorResponse) return errorResponse;

        return res.status(200).json({
            message: "Conversation retrieved successfully!",
            conversation: result.conversation
        });
    } catch (error) {
        console.error("Create Conversation Error:", error);

        return res.status(500).json({
            message: "Unable to create or retrieve conversation"
        });
    }
};

const listConversations = async (req, res) => {
    try {
        const result = await messagingService.listConversations(
            req.user.userId
        );

        return res.status(200).json({
            message: "Conversations fetched successfully!",
            unreadCount: result.unreadCount,
            conversations: result.conversations
        });
    } catch (error) {
        console.error("List Conversations Error:", error);

        return res.status(500).json({
            message: "Unable to fetch conversations"
        });
    }
};

const getMessages = async (req, res) => {
    try {
        const messages = await messagingService.getMessages(
            req.params.id,
            req.user.userId
        );

        if (!messages) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        return res.status(200).json({
            message: "Messages fetched successfully!",
            messages
        });
    } catch (error) {
        console.error("Get Messages Error:", error);

        return res.status(500).json({
            message: "Unable to fetch messages"
        });
    }
};

const sendMessage = async (req, res) => {
    try {
        const result = await messagingService.sendMessage(
            req.params.id,
            req.user.userId,
            req.body.content
        );

        if (result.status === "not-found") {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        return res.status(201).json({
            message: "Message sent successfully!",
            data: result.message
        });
    } catch (error) {
        console.error("Send Message Error:", error);

        return res.status(500).json({
            message: "Unable to send message"
        });
    }
};

const markMessagesRead = async (req, res) => {
    try {
        const result = await messagingService.markMessagesRead(
            req.params.id,
            req.user.userId
        );

        if (result === null) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        return res.status(200).json({
            message: "Messages marked as read",
            updatedCount: result.updatedCount,
            unreadCount: result.unreadCount,
            globalUnreadCount: result.globalUnreadCount
        });
    } catch (error) {
        console.error("Mark Messages Read Error:", error);

        return res.status(500).json({
            message: "Unable to mark messages as read"
        });
    }
};

const getUnreadMessageCount = async (req, res) => {
    try {
        const count = await messagingService.getUnreadMessageCount(
            req.user.userId
        );

        return res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error("Unread Message Count Error:", error);

        return res.status(500).json({
            message: "Unable to fetch unread message count"
        });
    }
};

module.exports = {
    createOrGetConversation,
    listConversations,
    getMessages,
    sendMessage,
    markMessagesRead,
    getUnreadMessageCount
};
