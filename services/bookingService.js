const prisma = require("../config/database");
const { createEventNotification } = require("./notificationService");
const realtimeService = require("./realtimeService");

const bookingSelect = {
    id: true,
    servicePrice: true,
    startDate: true,
    endDate: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    customer: {
        select: {
            id: true,
            name: true
        }
    },
    service: {
        select: {
            id: true,
            name: true,
            category: true,
            country: true,
            city: true,
            providerId: true,
            provider: {
                select: {
                    id: true,
                    name: true,
                    businessName: true
                }
            }
        }
    }
};

const overlappingConfirmedBooking = (tx, serviceId, startDate, endDate, excludingId) => {
    return tx.booking.findFirst({
        where: {
            serviceId,
            status: "CONFIRMED",
            startDate: { lt: endDate },
            endDate: { gt: startDate },
            ...(excludingId && { id: { not: excludingId } })
        },
        select: { id: true }
    });
};

const getBookingNotificationContent = (status, serviceName) => {
    switch (status) {
        case "CONFIRMED":
            return {
                title: "Booking Accepted",
                message: `Your booking for ${serviceName} has been accepted by the provider.`
            };
        case "REJECTED":
            return {
                title: "Booking Rejected",
                message: `Your booking request for ${serviceName} has been rejected by the provider.`
            };
        case "CANCELLED":
            return {
                title: "Booking Cancelled",
                message: `The booking for ${serviceName} has been cancelled.`
            };
        case "COMPLETED":
            return {
                title: "Booking Completed",
                message: `Your booking for ${serviceName} has been marked as completed.`
            };
        default:
            throw new Error(`Unsupported booking notification status: ${status}`);
    }
};

const createBooking = async (customerId, { serviceId, startDate, endDate }) => {
    const result = await prisma.$transaction(async (tx) => {
        const service = await tx.service.findUnique({
            where: { id: serviceId },
            select: {
                id: true,
                providerId: true,
                isActive: true,
                price: true
            }
        });

        if (!service || !service.isActive) {
            return { status: "property-not-found" };
        }

        if (service.providerId === customerId) {
            return { status: "self-booking" };
        }

        if (
            await overlappingConfirmedBooking(
                tx,
                serviceId,
                startDate,
                endDate
            )
        ) {
            return { status: "unavailable" };
        }

        const booking = await tx.booking.create({
            data: {
                serviceId,
                customerId,
                servicePrice: service.price,
                startDate,
                endDate
            },
            select: bookingSelect
        });

        const notification = await createEventNotification(tx, service.providerId, "BOOKING", {
            bookingId: booking.id,
            serviceId,
            status: booking.status
        }, {
            title: "New Booking Request",
            message: `You have received a new booking request from ${booking.customer.name} for ${booking.service.name}.`
        });

        return { status: "created", booking, notification };
    });

    if (result.status === "created") {
        realtimeService.emitToUser(
            result.booking.service.providerId,
            "booking:created",
            { booking: result.booking }
        );
        realtimeService.emitToUser(
            result.booking.service.providerId,
            "booking:updated",
            { booking: result.booking }
        );
        try {
            await realtimeService.emitNotification(result.notification);
        } catch (error) {
            console.error("Booking notification realtime error:", error);
        }
        return { status: result.status, booking: result.booking };
    }

    return result;
};

const listMyBookings = (customerId) => {
    return prisma.booking.findMany({
        where: { customerId },
        select: bookingSelect,
        orderBy: { createdAt: "desc" }
    });
};

const listReceivedBookings = (providerId) => {
    return prisma.booking.findMany({
        where: {
            service: { providerId }
        },
        select: bookingSelect,
        orderBy: { createdAt: "desc" }
    });
};

const listBookingHistory = (userId) => {
    return prisma.booking.findMany({
        where: {
            status: { in: ["REJECTED", "CANCELLED", "COMPLETED"] },
            OR: [
                { customerId: userId },
                { service: { providerId: userId } }
            ]
        },
        select: bookingSelect,
        orderBy: { updatedAt: "desc" }
    });
};

const getProviderDashboardSummary = async (providerId) => {
    const bookingGroups = await prisma.booking.groupBy({
        by: ["status"],
        where: {
            service: { providerId }
        },
        _count: { _all: true },
        _sum: { servicePrice: true }
    });

    const summary = {
        totalEarnings: 0,
        completedBookingsCount: 0,
        pendingBookingsCount: 0,
        acceptedBookingsCount: 0,
        totalBookingsCount: 0
    };

    for (const group of bookingGroups) {
        const count = group._count._all;
        summary.totalBookingsCount += count;

        if (group.status === "COMPLETED") {
            summary.completedBookingsCount = count;
            summary.totalEarnings = Number(group._sum.servicePrice ?? 0);
        } else if (group.status === "PENDING") {
            summary.pendingBookingsCount = count;
        } else if (group.status === "CONFIRMED") {
            summary.acceptedBookingsCount = count;
        }
    }

    return summary;
};

const getBookingForParticipant = async (bookingId, userId) => {
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            OR: [
                { customerId: userId },
                { service: { providerId: userId } }
            ]
        },
        select: bookingSelect
    });

    return booking;
};

const updateBookingStatus = async (bookingId, actor, requestedStatus) => {
    const result = await prisma.$transaction(
        async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                select: {
                    id: true,
                    serviceId: true,
                    customerId: true,
                    startDate: true,
                    endDate: true,
                    status: true,
                    service: {
                        select: {
                            name: true,
                            providerId: true,
                            isActive: true
                        }
                    }
                }
            });

            if (!booking) {
                return { status: "not-found" };
            }

            const isOwner = booking.service.providerId === actor.userId;
            const isCustomer = booking.customerId === actor.userId;

            if (!isOwner && !isCustomer) {
                return { status: "forbidden" };
            }

            if (
                isCustomer &&
                !["CANCELLED", "COMPLETED"].includes(requestedStatus)
            ) {
                return { status: "forbidden" };
            }

            const validTransition =
                (booking.status === "PENDING" &&
                    ((requestedStatus === "CONFIRMED" && isOwner) ||
                        (requestedStatus === "REJECTED" && isOwner) ||
                        requestedStatus === "CANCELLED")) ||
                (booking.status === "CONFIRMED" &&
                    (requestedStatus === "CANCELLED" ||
                        (requestedStatus === "COMPLETED" && isCustomer)));

            if (!validTransition) {
                return { status: "invalid-transition" };
            }

            if (requestedStatus === "CONFIRMED") {
                if (!booking.service.isActive) {
                    return { status: "property-not-found" };
                }

                if (
                    await overlappingConfirmedBooking(
                        tx,
                        booking.serviceId,
                        booking.startDate,
                        booking.endDate,
                        booking.id
                    )
                ) {
                    return { status: "unavailable" };
                }
            }

            const updated = await tx.booking.update({
                where: { id: booking.id },
                data: { status: requestedStatus },
                select: bookingSelect
            });

            const recipientId = isOwner
                ? booking.customerId
                : booking.service.providerId;

            const notification = await createEventNotification(tx, recipientId, "BOOKING", {
                bookingId: booking.id,
                serviceId: booking.serviceId,
                status: requestedStatus
            }, getBookingNotificationContent(
                requestedStatus,
                booking.service.name
            ));

            return {
                status: "updated",
                booking: updated,
                notification
            };
        },
        { isolationLevel: "Serializable" }
    );

    if (result.status !== "updated") return result;

    const eventByStatus = {
        CONFIRMED: "booking:accepted",
        REJECTED: "booking:rejected",
        CANCELLED: "booking:cancelled",
        COMPLETED: "booking:completed"
    };
    const participantIds = [
        result.booking.customer.id,
        result.booking.service.providerId
    ];
    const payload = { booking: result.booking };
    realtimeService.emitToUsers(
        participantIds,
        eventByStatus[result.booking.status],
        payload
    );
    realtimeService.emitToUsers(
        participantIds,
        "booking:updated",
        payload
    );

    try {
        await realtimeService.emitNotification(result.notification);
    } catch (error) {
        console.error("Booking notification realtime error:", error);
    }

    return { status: result.status, booking: result.booking };
};

module.exports = {
    createBooking,
    listMyBookings,
    listReceivedBookings,
    listBookingHistory,
    getProviderDashboardSummary,
    getBookingForParticipant,
    updateBookingStatus
};
