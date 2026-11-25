const createEventNotification = async (
    tx,
    userId,
    type,
    data,
    { title, message }
) => {
    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { notificationsEnabled: true }
    });

    if (!user || !user.notificationsEnabled) {
        return null;
    }

    return tx.notification.create({
        data: {
            userId,
            title,
            message,
            type,
            data
        },
        select: {
            id: true,
            userId: true,
            title: true,
            message: true,
            type: true,
            data: true,
            createdAt: true,
            readAt: true
        }
    });
};

module.exports = {
    createEventNotification
};
