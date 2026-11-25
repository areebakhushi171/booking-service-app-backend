ALTER TABLE "Service"
ADD CONSTRAINT "Service_price_positive_check"
CHECK ("price" > 0);
