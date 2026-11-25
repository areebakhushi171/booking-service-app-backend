const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const bookingController = require("../controllers/bookingController");
const {
    bookingIdValidators,
    createBookingValidators,
    updateBookingStatusValidators
} = require("../validators/bookingValidators");

const router = express.Router();

router.use(authMiddleware);
router.post(
    "/",
    authorizeRoles("customer"),
    createBookingValidators,
    bookingController.createBooking
);
router.get(
    "/mine",
    authorizeRoles("customer"),
    bookingController.listMyBookings
);
router.get(
    "/received",
    authorizeRoles("provider"),
    bookingController.listReceivedBookings
);
router.get(
    "/dashboard",
    authorizeRoles("provider"),
    bookingController.getProviderDashboardSummary
);
router.get("/history", bookingController.listBookingHistory);
router.get("/:id", bookingIdValidators, bookingController.getBooking);
router.patch(
    "/:id/status",
    bookingIdValidators,
    updateBookingStatusValidators,
    bookingController.updateBookingStatus
);
router.patch(
    "/:id/accept",
    authorizeRoles("provider"),
    bookingIdValidators,
    (req, res, next) => {
        req.body = { ...(req.body ?? {}), status: "CONFIRMED" };
        next();
    },
    bookingController.updateBookingStatus
);
router.patch(
    "/:id/reject",
    authorizeRoles("provider"),
    bookingIdValidators,
    (req, res, next) => {
        req.body = { ...(req.body ?? {}), status: "REJECTED" };
        next();
    },
    bookingController.updateBookingStatus
);
router.patch(
    "/:id/cancel",
    bookingIdValidators,
    (req, res, next) => {
        req.body = { ...(req.body ?? {}), status: "CANCELLED" };
        next();
    },
    bookingController.updateBookingStatus
);

module.exports = router;
