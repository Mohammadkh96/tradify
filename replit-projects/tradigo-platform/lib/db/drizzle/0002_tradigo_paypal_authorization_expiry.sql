ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS paypal_authorization_status text;
ALTER TABLE tradigo_sessions ADD COLUMN IF NOT EXISTS paypal_authorization_expires_at timestamp with time zone;