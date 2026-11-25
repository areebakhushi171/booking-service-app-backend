const prisma = require("../config/database");
const realtimeService = require("./realtimeService");

const favoriteSelect = {
    id: true,
    createdAt: true,
    service: {
        select: {
            id: true,
            name: true,
            description: true,
            category: true,
            price: true,
            imageUrl: true,
            country: true,
            city: true,
            isActive: true,
            providerId: true
        }
    }
};

const listFavorites = (userId) => {
    return prisma.favorite.findMany({
        where: { userId },
        select: favoriteSelect,
        orderBy: { createdAt: "desc" }
    });
};

const addFavorite = async (userId, serviceId) => {
    return prisma.$transaction(async (tx) => {
        const service = await tx.service.findFirst({
            where: { id: serviceId, isActive: true },
            select: { id: true }
        });

        if (!service) {
            return { status: "property-not-found" };
        }

        const existing = await tx.favorite.findUnique({
            where: {
                userId_serviceId: {
                    userId,
                    serviceId
                }
            },
            select: { id: true }
        });
        const favorite = await tx.favorite.upsert({
            where: {
                userId_serviceId: {
                    userId,
                    serviceId
                }
            },
            create: { userId, serviceId },
            update: {},
            select: favoriteSelect
        });

        return {
            status: "added",
            favorite,
            created: !existing
        };
    });
};

const removeFavorite = async (userId, serviceId) => {
    const result = await prisma.favorite.deleteMany({
        where: { userId, serviceId }
    });

    if (result.count > 0) {
        realtimeService.emitToUser(userId, "favorite:removed", {
            userId,
            serviceId
        });
    }

    return result.count;
};

const isFavorited = async (userId, serviceId) => {
    const favorite = await prisma.favorite.findUnique({
        where: {
            userId_serviceId: {
                userId,
                serviceId
            }
        },
        select: { id: true }
    });

    return Boolean(favorite);
};

module.exports = {
    listFavorites,
    addFavorite,
    removeFavorite,
    isFavorited
};
