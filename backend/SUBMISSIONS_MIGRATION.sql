-- Submissions: one row per final submission (details + payment evidence complete).
-- Used to trigger admin email and avoid duplicate notifications.

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_notified boolean NOT NULL DEFAULT false,
  admin_notified_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_admin_notified ON submissions(admin_notified);
COMMENT ON TABLE submissions IS 'Final submission records (details + payment proof). Admin email sent when admin_notified = true.';
