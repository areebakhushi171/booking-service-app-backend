const bookingService = require("../services/bookingService");

const sendStatusError = (res, status) => {
    if (status === "property-not-found" || status === "not-found") {
        return res.status(404).json({
            message: "Property or booking not found"
        });
    }

    if (status === "forbidden") {
        return res.status(403).json({
            message: "You are not authorized to update this booking"
        });
    }

    if (status === "self-booking") {
        return res.status(400).json({
            message: "You cannot book your own property"
        });
    }

    if (status === "unavailable") {
        return res.status(409).json({
            message: "Property is unavailable for the selected dates"
        });
    }

    if (status === "invalid-transition") {
        return res.status(409).json({
            message: "This booking status transition is not allowed"
        });
    }

    return null;
};

const handleBookingError = (
    res,
    error,
    logMessage,
    responseMessage
) => {
    if (error.code === "P2034") {
        return res.status(409).json({
            message: "Booking changed concurrently; please retry"
        });
    }

    console.error(logMessage, error);

    return res.status(500).json({
        message: responseMessage
    });
};

const createBooking = async (req, res) => {
    try {
        const result = await bookingService.createBooking(
            req.user.userId,
            req.body
        );
        const errorResponse = sendStatusError(res, result.status);

        if (errorResponse) return errorResponse;

        return res.status(201).json({
            message: "Booking request created successfully!",
            booking: result.booking
        });
    } catch (error) {
        return handleBookingError(
            res,
            error,
            "Create Booking Error:",
            "Unable to create booking"
        );
    }
};

const listMyBookings = async (req, res) => {
    try {
        const bookings = await bookingService.listMyBookings(req.user.userId);

        return res.status(200).json({
            message: "Bookings fetched successfully!",
            bookings
        });
    } catch (error) {
        console.error("List Bookings Error:", error);

        return res.status(500).json({
            message: "Unable to fetch bookings"
        });
    }
};

const listReceivedBookings = async (req, res) => {
    try {
        const bookings = await bookingService.listReceivedBookings(
            req.user.userId
        );

        return res.status(200).json({
            message: "Received bookings fetched successfully!",
            bookings
        });
    } catch (error) {
        console.error("List Received Bookings Error:", error);

        return res.status(500).json({
            message: "Unable to fetch received bookings"
        });
    }
};

const getProviderDashboardSummary = async (req, res) => {
    try {
        const summary = await bookingService.getProviderDashboardSummary(
            req.user.userId
        );

        return res.status(200).json({
            message: "Provider dashboard summary fetched successfully!",
            ...summary
        });
    } catch (error) {
        console.error("Provider Dashboard Summary Error:", error);

        return res.status(500).json({
            message: "Unable to fetch provider dashboard summary"
        });
    }
};

const listBookingHistory = async (req, res) => {
    try {
        const bookings = await bookingService.listBookingHistory(
            req.user.userId
        );

        return res.status(200).json({
            message: "Booking history fetched successfully!",
            bookings
        });
    } catch (error) {
        console.error("Booking History Error:", error);

        return res.status(500).json({
            message: "Unable to fetch booking history"
        });
    }
};

const getBooking = async (req, res) => {
    try {
        const booking = await bookingService.getBookingForParticipant(
            req.params.id,
            req.user.userId
        );

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        return res.status(200).json({
            message: "Booking fetched successfully!",
            booking
        });
    } catch (error) {
        console.error("Get Booking Error:", error);

        return res.status(500).json({
            message: "Unable to fetch booking"
        });
    }
};

const updateBookingStatus = async (req, res) => {
    try {
        const result = await bookingService.updateBookingStatus(
            req.params.id,
            req.user,
            req.body.status
        );
        const errorResponse = sendStatusError(res, result.status);

        if (errorResponse) return errorResponse;

        return res.status(200).json({
            message: "Booking status updated successfully!",
            booking: result.booking
        });
    } catch (error) {
        return handleBookingError(
            res,
            error,
            "Update Booking Status Error:",
            "Unable to update booking status"
        );
    }
};

module.exports = {
    createBooking,
    listMyBookings,
    listReceivedBookings,
    getProviderDashboardSummary,
    listBookingHistory,
    getBooking,
    updateBookingStatus
};
