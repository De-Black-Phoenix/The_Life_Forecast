-- Add service_type to users and payments for Life Forecast vs Destiny Readings.
-- Existing records default to "life_forecast" (historical Proceed flow).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'life_forecast';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'life_forecast';

COMMENT ON COLUMN users.service_type IS 'life_forecast | destiny_readings';
COMMENT ON COLUMN payments.service_type IS 'life_forecast | destiny_readings';
