ALTER TABLE "Notification"
ADD COLUMN "title" TEXT,
ADD COLUMN "message" TEXT;

WITH legacy_context AS (
    SELECT
        notification."id",
        notification."type",
        notification."data",
        service."name" AS service_name,
        customer."name" AS customer_name,
        sender."name" AS sender_name
    FROM "Notification" notification
    LEFT JOIN "Booking" booking
        ON booking."id" = notification."data" ->> 'bookingId'
    LEFT JOIN "Service" service
        ON service."id" = COALESCE(
            booking."serviceId",
            notification."data" ->> 'serviceId'
        )
    LEFT JOIN "User" customer
        ON customer."id" = booking."customerId"
    LEFT JOIN "Message" event_message
        ON event_message."id" = notification."data" ->> 'messageId'
    LEFT JOIN "User" sender
        ON sender."id" = event_message."senderId"
)
UPDATE "Notification" notification
SET
    "title" = CASE
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'PENDING'
            THEN 'New Booking Request'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CONFIRMED'
            THEN 'Booking Accepted'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'REJECTED'
            THEN 'Booking Rejected'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CANCELLED'
            THEN 'Booking Cancelled'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'COMPLETED'
            THEN 'Booking Completed'
        WHEN legacy_context."type" = 'MESSAGE'
            THEN 'New Message'
        ELSE 'Notification'
    END,
    "message" = CASE
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'PENDING'
            AND legacy_context.service_name IS NOT NULL
            AND legacy_context.customer_name IS NOT NULL
            THEN 'You have received a new booking request from '
                || legacy_context.customer_name || ' for '
                || legacy_context.service_name || '.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'PENDING'
            THEN 'A new booking request has been received.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CONFIRMED'
            AND legacy_context.service_name IS NOT NULL
            THEN 'Your booking for ' || legacy_context.service_name
                || ' has been accepted by the provider.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CONFIRMED'
            THEN 'Your booking has been accepted by the provider.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'REJECTED'
            AND legacy_context.service_name IS NOT NULL
            THEN 'Your booking request for ' || legacy_context.service_name
                || ' has been rejected by the provider.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'REJECTED'
            THEN 'Your booking request has been rejected by the provider.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CANCELLED'
            AND legacy_context.service_name IS NOT NULL
            THEN 'The booking for ' || legacy_context.service_name
                || ' has been cancelled.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'CANCELLED'
            THEN 'The booking has been cancelled.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'COMPLETED'
            AND legacy_context.service_name IS NOT NULL
            THEN 'Your booking for ' || legacy_context.service_name
                || ' has been marked as completed.'
        WHEN legacy_context."type" = 'BOOKING'
            AND legacy_context."data" ->> 'status' = 'COMPLETED'
            THEN 'Your booking has been marked as completed.'
        WHEN legacy_context."type" = 'BOOKING'
            THEN 'Your booking status has been updated.'
        WHEN legacy_context."type" = 'MESSAGE'
            AND legacy_context.sender_name IS NOT NULL
            THEN 'You have a new message from '
                || legacy_context.sender_name || '.'
        WHEN legacy_context."type" = 'MESSAGE'
            THEN 'You have a new message.'
        ELSE 'You have a new notification.'
    END
FROM legacy_context
WHERE notification."id" = legacy_context."id";

ALTER TABLE "Notification"
ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "message" SET NOT NULL;
