CREATE TABLE "tradigo_coaches" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "headline" text NOT NULL,
  "bio" text NOT NULL,
  "markets" text[] NOT NULL,
  "specialties" text[] NOT NULL,
  "languages" text[] NOT NULL,
  "years_of_experience" integer NOT NULL,
  "hourly_rate_cents" integer NOT NULL,
  "instant_rate_per_minute_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "verification_status" text NOT NULL,
  "rating_average_tenths" integer DEFAULT 0 NOT NULL,
  "rating_count" integer DEFAULT 0 NOT NULL,
  "approved" boolean DEFAULT false NOT NULL,
  "availability" text DEFAULT 'OFFLINE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tradigo_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "trader_id" text NOT NULL,
  "coach_id" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "scheduled_at" timestamp with time zone,
  "duration_minutes" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "payment_status" text NOT NULL,
  "paypal_order_id" text,
  "paypal_authorization_id" text,
  "payment_approval_url" text,
  "room_name" text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "tradigo_session_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "actor_id" text NOT NULL,
  "event_type" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "tradigo_sessions_trader_created_idx" ON "tradigo_sessions" USING btree ("trader_id", "created_at");
CREATE INDEX "tradigo_sessions_coach_status_idx" ON "tradigo_sessions" USING btree ("coach_id", "status");
CREATE INDEX "tradigo_session_events_session_created_idx" ON "tradigo_session_events" USING btree ("session_id", "created_at");