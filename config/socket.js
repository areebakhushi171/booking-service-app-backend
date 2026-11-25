const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const prisma = require("./database");
const realtimeService = require("../services/realtimeService");

const socketDebugEnabled = () => process.env.SOCKET_DEBUG === "true";

const acknowledge = (callback, response) => {
    if (typeof callback === "function") callback(response);
};

const getConversationParticipantIds = async (userId) => {
    const conversations = await prisma.conversation.findMany({
        where: {
            OR: [{ customerId: userId }, { ownerId: userId }]
        },
        select: {
            customerId: true,
            ownerId: true
        }
    });

    return [...new Set(conversations.map((conversation) =>
        conversation.customerId === userId
            ? conversation.ownerId
            : conversation.customerId
    ))];
};

const attachSocketServer = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_ORIGIN || "*"
        }
    });

    io.use((socket, next) => {
        const authToken = socket.handshake.auth?.token;
        const authorization = socket.handshake.headers.authorization;
        const token =
            authToken ||
            (authorization?.startsWith("Bearer ")
                ? authorization.slice(7)
                : null);

        if (typeof token !== "string" || !token) {
            if (socketDebugEnabled()) {
                console.warn("[Socket.IO] authentication rejected: missing token");
            }
            return next(new Error("Authentication token is required"));
        }

        try {
            const user = jwt.verify(token, process.env.JWT_SECRET);
            if (
                typeof user.userId !== "string" ||
                !["customer", "provider"].includes(user.role)
            ) {
                if (socketDebugEnabled()) {
                    console.warn("[Socket.IO] authentication rejected: invalid claims");
                }
                return next(new Error("Invalid authentication token"));
            }

            socket.data.user = {
                userId: user.userId,
                role: user.role
            };
            return next();
        } catch {
            if (socketDebugEnabled()) {
                console.warn("[Socket.IO] authentication rejected: invalid or expired token");
            }
            return next(new Error("Invalid or expired authentication token"));
        }
    });

    realtimeService.setSocketServer(io);

    io.on("connection", (socket) => {
        const { userId, role } = socket.data.user;
        const privateRoom = realtimeService.userRoom(userId);
        let roomJoin;
        try {
            roomJoin = Promise.resolve(socket.join(privateRoom));
        } catch (error) {
            console.error("Socket user room join error:", error);
            socket.disconnect(true);
            return;
        }
        if (socketDebugEnabled()) {
            console.info("[Socket.IO] connected", {
                userId,
                role,
                socketId: socket.id,
                room: privateRoom
            });
        }

        void roomJoin.then(async () => {
            if (!socket.connected) return;
            if (socketDebugEnabled()) {
                console.info("[Socket.IO] user room joined", {
                    userId,
                    socketId: socket.id,
                    room: privateRoom
                });
            }
            const sockets = await io.in(privateRoom).fetchSockets();
            if (sockets.length === 1) {
                const participantIds =
                    await getConversationParticipantIds(userId);
                realtimeService.emitToUsers(
                    participantIds,
                    "user:online",
                    { userId }
                );
            }
        }).catch((error) => {
            console.error("Socket user room initialization error:", error);
            socket.disconnect(true);
        });

        socket.on("conversation:join", async (payload = {}, callback) => {
            const conversationId = payload.conversationId;
            if (
                typeof conversationId !== "string" ||
                conversationId.length === 0
            ) {
                acknowledge(callback, {
                    error: "A conversation ID is required"
                });
                return;
            }

            try {
                const conversation = await prisma.conversation.findFirst({
                    where: {
                        id: conversationId,
                        OR: [{ customerId: userId }, { ownerId: userId }]
                    },
                    select: { id: true }
                });

                if (!conversation) {
                    acknowledge(callback, {
                        error: "Conversation not found"
                    });
                    if (socketDebugEnabled()) {
                        console.warn("[Socket.IO] conversation join denied", {
                            userId,
                            conversationId
                        });
                    }
                    return;
                }

                socket.join(
                    realtimeService.conversationRoom(conversationId)
                );
                acknowledge(callback, {
                    joined: true,
                    conversationId
                });
                if (socketDebugEnabled()) {
                    console.info("[Socket.IO] conversation joined", {
                        userId,
                        conversationId,
                        socketId: socket.id
                    });
                }
            } catch (error) {
                console.error("Socket conversation join error:", error);
                acknowledge(callback, {
                    error: "Unable to join conversation"
                });
            }
        });

        socket.on("conversation:leave", async (payload = {}, callback) => {
            const conversationId = payload.conversationId;
            if (
                typeof conversationId !== "string" ||
                conversationId.length === 0
            ) {
                acknowledge(callback, {
                    error: "A conversation ID is required"
                });
                return;
            }

            try {
                const conversation = await prisma.conversation.findFirst({
                    where: {
                        id: conversationId,
                        OR: [{ customerId: userId }, { ownerId: userId }]
                    },
                    select: { id: true }
                });

                if (!conversation) {
                    acknowledge(callback, {
                        error: "Conversation not found"
                    });
                    return;
                }

                socket.leave(
                    realtimeService.conversationRoom(conversationId)
                );
                acknowledge(callback, {
                    left: true,
                    conversationId
                });
                if (socketDebugEnabled()) {
                    console.info("[Socket.IO] conversation left", {
                        userId,
                        conversationId,
                        socketId: socket.id
                    });
                }
            } catch (error) {
                console.error("Socket conversation leave error:", error);
                acknowledge(callback, {
                    error: "Unable to leave conversation"
                });
            }
        });

        const emitTyping = (event) => async (payload = {}) => {
            const conversationId = payload.conversationId;
            if (typeof conversationId !== "string") return;

            const room =
                realtimeService.conversationRoom(conversationId);
            if (!socket.rooms.has(room)) return;

            try {
                const conversation = await prisma.conversation.findFirst({
                    where: {
                        id: conversationId,
                        OR: [{ customerId: userId }, { ownerId: userId }]
                    },
                    select: { id: true }
                });
                if (!conversation) return;

                socket.to(room).emit(event, {
                    conversationId,
                    userId
                });
                if (socketDebugEnabled()) {
                    console.info("[Socket.IO] typing event emitted", {
                        event,
                        userId,
                        conversationId
                    });
                }
            } catch (error) {
                console.error("Socket typing event error:", error);
            }
        };

        socket.on("message:typing", emitTyping("message:typing"));
        socket.on("message:stop_typing", emitTyping("message:stop_typing"));

        socket.on("disconnect", (reason) => {
            if (socketDebugEnabled()) {
                console.info("[Socket.IO] disconnected", {
                    userId,
                    role,
                    socketId: socket.id,
                    reason
                });
            }
            void (async () => {
                const sockets = await io.in(privateRoom).fetchSockets();
                if (sockets.length > 0) return;

                const participantIds =
                    await getConversationParticipantIds(userId);
                realtimeService.emitToUsers(
                    participantIds,
                    "user:offline",
                    { userId }
                );
                console.info("Socket disconnected:", reason);
            })().catch((error) => {
                console.error("Socket presence cleanup error:", error);
            });
        });
    });

    return io;
};

module.exports = attachSocketServer;
