-- Admin authentication table for the private dashboard.
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  token_version integer NOT NULL DEFAULT 0,
  force_password_change boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
