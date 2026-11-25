const prisma = require("../config/database");

const checkDatabaseConnection = () => {
    return prisma.$queryRaw`SELECT 1`;
};

const getBookEaseUsers = () => {
    return prisma.user.findMany({
        select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
            businessName: true,
            businessCategory: true,
            createdAt: true
        }
    });
};

module.exports = {
    checkDatabaseConnection,
    getBookEaseUsers
};
