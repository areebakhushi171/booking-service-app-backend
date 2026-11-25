const prisma = require("../config/database");
const { createEventNotification } = require("./notificationService");
const realtimeService = require("./realtimeService");

const conversationSelect = {
    id: true,
    customerId: true,
    ownerId: true,
    serviceId: true,
    createdAt: true,
    updatedAt: true,
    customer: {
        select: {
            id: true,
            name: true
        }
    },
    owner: {
        select: {
            id: true,
            name: true,
            businessName: true
        }
    },
    service: {
        select: {
            id: true,
            name: true,
            category: true,
            country: true,
            city: true
        }
    }
};

const isParticipant = (conversation, userId) =>
    conversation.customerId === userId || conversation.ownerId === userId;

const createOrGetConversation = async (user, { serviceId, customerId }) => {
    const result = await prisma.$transaction(async (tx) => {
        const service = await tx.service.findFirst({
            where: { id: serviceId, isActive: true },
            select: { id: true, providerId: true }
        });

        if (!service) {
            return { status: "property-not-found" };
        }

        let customer;
        let ownerId;

        if (user.role === "customer") {
            customer = user.userId;
            ownerId = service.providerId;

            if (customer === ownerId) {
                return { status: "self-conversation" };
            }
        } else if (user.role === "provider") {
            if (service.providerId !== user.userId) {
                return { status: "not-owner" };
            }

            if (!customerId) {
                return { status: "customer-required" };
            }

            const target = await tx.user.findUnique({
                where: { id: customerId },
                select: { id: true, role: true }
            });

            if (!target || target.role !== "customer") {
                return { status: "customer-not-found" };
            }

            customer = target.id;
            ownerId = user.userId;
        } else {
            return { status: "forbidden" };
        }

        const key = {
            customerId_ownerId_serviceId: {
                customerId: customer,
                ownerId,
                serviceId
            }
        };
        const existing = await tx.conversation.findUnique({
            where: key,
            select: { id: true }
        });
        const conversation = await tx.conversation.upsert({
            where: key,
            create: {
                customerId: customer,
                ownerId,
                serviceId
            },
            update: {},
            select: conversationSelect
        });

        return { status: "retrieved", conversation, created: !existing };
    });

    if (result.status === "retrieved" && result.created) {
        realtimeService.emitToUsers(
            [result.conversation.customerId, result.conversation.ownerId],
            "conversation:updated",
            { conversation: result.conversation }
        );
    }

    return result;
};

const listConversations = (userId) => {
    return prisma.$transaction(async (tx) => {
        const conversations = await tx.conversation.findMany({
            where: {
                OR: [{ customerId: userId }, { ownerId: userId }]
            },
            select: {
                ...conversationSelect,
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        senderId: true,
                        content: true,
                        createdAt: true,
                        readAt: true
                    }
                }
            },
            orderBy: { updatedAt: "desc" }
        });

        const conversationIds = conversations.map(({ id }) => id);
        const unreadCounts = conversationIds.length
            ? await tx.message.groupBy({
                by: ["conversationId"],
                where: {
                    conversationId: { in: conversationIds },
                    senderId: { not: userId },
                    readAt: null
                },
                _count: { _all: true }
            })
            : [];
        const unreadCountByConversation = new Map(
            unreadCounts.map(({ conversationId, _count }) => [
                conversationId,
                _count._all
            ])
        );

        const conversationsWithUnreadCounts = conversations.map((conversation) => ({
            ...conversation,
            unreadCount: unreadCountByConversation.get(conversation.id) || 0
        }));

        return {
            conversations: conversationsWithUnreadCounts,
            unreadCount: conversationsWithUnreadCounts.reduce(
                (total, conversation) => total + conversation.unreadCount,
                0
            )
        };
    });
};

const getMessages = async (conversationId, userId) => {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            customerId: true,
            ownerId: true
        }
    });

    if (!conversation || !isParticipant(conversation, userId)) {
        return null;
    }

    const messages = await prisma.message.findMany({
        where: { conversationId },
        select: {
            id: true,
            conversationId: true,
            senderId: true,
            content: true,
            createdAt: true,
            readAt: true
        },
        orderBy: { createdAt: "asc" }
    });

    return messages;
};

const sendMessage = async (conversationId, userId, content) => {
    const result = await prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                customerId: true,
                ownerId: true
            }
        });

        if (!conversation || !isParticipant(conversation, userId)) {
            return { status: "not-found" };
        }

        const message = await tx.message.create({
            data: {
                conversationId,
                senderId: userId,
                content,
                readAt: null
            },
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                createdAt: true,
                readAt: true,
                sender: {
                    select: { name: true }
                }
            }
        });

        await tx.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        const recipientId =
            conversation.customerId === userId
                ? conversation.ownerId
                : conversation.customerId;

        const notification = await createEventNotification(tx, recipientId, "MESSAGE", {
            conversationId,
            messageId: message.id
        }, {
            title: "New Message",
            message: `You have a new message from ${message.sender.name}.`
        });
        const unreadCount = await tx.message.count({
            where: {
                conversationId,
                senderId: userId,
                readAt: null
            }
        });
        const globalUnreadCount = await tx.message.count({
            where: {
                senderId: { not: recipientId },
                readAt: null,
                conversation: {
                    OR: [
                        { customerId: recipientId },
                        { ownerId: recipientId }
                    ]
                }
            }
        });

        const { sender, ...responseMessage } = message;

        return {
            status: "sent",
            message: responseMessage,
            notification,
            recipientId,
            unreadCount,
            globalUnreadCount
        };
    });

    if (result.status !== "sent") return result;

    realtimeService.emitToUser(result.recipientId, "message:new", {
        conversationId,
        message: result.message,
        unreadCount: result.unreadCount,
        globalUnreadCount: result.globalUnreadCount
    });
    realtimeService.emitToUser(
        result.recipientId,
        "chat:unread_count_updated",
        { unreadCount: result.globalUnreadCount }
    );
    realtimeService.emitToUsers(
        [result.recipientId, userId],
        "conversation:updated",
        {
            conversationId,
            latestMessage: result.message
        }
    );

    try {
        await realtimeService.emitNotification(result.notification);
    } catch (error) {
        console.error("Message notification realtime error:", error);
    }

    return { status: "sent", message: result.message };
};

const markMessagesRead = async (conversationId, userId) => {
    const result = await prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                customerId: true,
                ownerId: true
            }
        });

        if (!conversation || !isParticipant(conversation, userId)) {
            return null;
        }

        const incomingSenderId =
            conversation.customerId === userId
                ? conversation.ownerId
                : conversation.customerId;
        const unreadMessages = await tx.message.findMany({
            where: {
                conversationId,
                senderId: incomingSenderId,
                readAt: null
            },
            select: { id: true }
        });
        const readAt = new Date();
        const result = await tx.message.updateMany({
            where: {
                conversationId,
                senderId: incomingSenderId,
                readAt: null
            },
            data: { readAt }
        });
        const unreadCount = await tx.message.count({
            where: {
                conversationId,
                senderId: incomingSenderId,
                readAt: null
            }
        });
        const globalUnreadCount = await tx.message.count({
            where: {
                senderId: { not: userId },
                readAt: null,
                conversation: {
                    OR: [{ customerId: userId }, { ownerId: userId }]
                }
            }
        });

        return {
            updatedCount: result.count,
            unreadCount,
            globalUnreadCount,
            incomingSenderId,
            messageIds: unreadMessages.map(({ id }) => id),
            readAt
        };
    });

    if (!result) return null;

    if (result.messageIds.length > 0) {
        realtimeService.emitToUser(result.incomingSenderId, "message:read", {
            conversationId,
            readerId: userId,
            messageIds: result.messageIds,
            readAt: result.readAt
        });
    }
    realtimeService.emitToUser(userId, "chat:unread_count_updated", {
        unreadCount: result.globalUnreadCount
    });

    const {
        incomingSenderId,
        messageIds,
        readAt,
        ...response
    } = result;
    return response;
};

const getUnreadMessageCount = (userId) => {
    return prisma.message.count({
        where: {
            senderId: { not: userId },
            readAt: null,
            conversation: {
                OR: [{ customerId: userId }, { ownerId: userId }]
            }
        }
    });
};

module.exports = {
    createOrGetConversation,
    listConversations,
    getMessages,
    sendMessage,
    markMessagesRead,
    getUnreadMessageCount
};
