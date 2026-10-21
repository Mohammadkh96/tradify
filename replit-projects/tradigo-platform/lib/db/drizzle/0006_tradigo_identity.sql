CREATE TABLE IF NOT EXISTS tradigo_users (
  id text PRIMARY KEY,
  firebase_uid text NOT NULL,
  email text NOT NULL,
  email_normalized text,
  display_name text NOT NULL,
  avatar_url text,
  password_hash text,
  local_session_version integer NOT NULL DEFAULT 0,
  consent_accepted_at timestamp with time zone,
  consent_version text,
  role text NOT NULL DEFAULT 'TRADER',
  status text NOT NULL DEFAULT 'ACTIVE',
  country_code text NOT NULL DEFAULT 'US',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_users_firebase_uid_idx ON tradigo_users(firebase_uid);
CREATE UNIQUE INDEX IF NOT EXISTS tradigo_users_email_normalized_idx ON tradigo_users(email_normalized);
CREATE INDEX IF NOT EXISTS tradigo_users_role_status_idx ON tradigo_users(role, status);

CREATE TABLE IF NOT EXISTS tradigo_trader_profiles (
  user_id text PRIMARY KEY,
  experience_level text NOT NULL DEFAULT 'BEGINNER',
  preferred_markets text[] NOT NULL DEFAULT '{}',
  instruments text[] NOT NULL DEFAULT '{}',
  trading_styles text[] NOT NULL DEFAULT '{}',
  methodologies text[] NOT NULL DEFAULT '{}',
  timezone text,
  onboarding_current_step integer NOT NULL DEFAULT 1,
  onboarding_completed_at timestamp with time zone,
  total_sessions_completed integer NOT NULL DEFAULT 0,
  total_spent_cents integer NOT NULL DEFAULT 0,
  blocked_coach_ids text[] NOT NULL DEFAULT '{}',
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tradigo_favorites (
  trader_id text NOT NULL,
  coach_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (trader_id, coach_id)
);
CREATE INDEX IF NOT EXISTS tradigo_favorites_trader_idx ON tradigo_favorites(trader_id, created_at);

CREATE TABLE IF NOT EXISTS tradigo_notification_states (
  user_id text NOT NULL,
  event_id integer NOT NULL,
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS tradigo_notification_states_user_read_idx ON tradigo_notification_states(user_id, read_at);