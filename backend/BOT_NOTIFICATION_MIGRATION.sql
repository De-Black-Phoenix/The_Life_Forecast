-- Payments: track payment-verified bot notification (prevent duplicates, log errors)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_verified_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_verified_notified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_bot_message_error text NULL;

-- Users: store reading outcome and send status
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reading_outcome_text text NULL,
  ADD COLUMN IF NOT EXISTS reading_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reading_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reading_send_error text NULL;

COMMENT ON COLUMN payments.payment_verified_notified IS 'True after user was sent payment-verified WhatsApp message';
COMMENT ON COLUMN users.reading_sent IS 'True after reading outcome was sent to user via bot';
