CREATE TABLE "admin_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"access_key" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_access_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" text NOT NULL,
	"action_type" text NOT NULL,
	"target_user_id" text NOT NULL,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_insight_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"response" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_performance_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"timeframe" text NOT NULL,
	"insight_text" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_tier" text NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"cost_usd" text NOT NULL,
	"request_duration" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"drawdown_enabled" boolean DEFAULT true,
	"drawdown_in_app" boolean DEFAULT true,
	"drawdown_email" boolean DEFAULT true,
	"drawdown_warn_threshold" integer DEFAULT 70,
	"drawdown_critical_threshold" integer DEFAULT 90,
	"revenge_enabled" boolean DEFAULT true,
	"revenge_in_app" boolean DEFAULT true,
	"revenge_email" boolean DEFAULT true,
	"overtrading_enabled" boolean DEFAULT true,
	"overtrading_in_app" boolean DEFAULT true,
	"overtrading_email" boolean DEFAULT false,
	"overtrading_daily_cap" integer DEFAULT 10,
	"strategy_deviation_enabled" boolean DEFAULT true,
	"strategy_deviation_in_app" boolean DEFAULT true,
	"strategy_deviation_email" boolean DEFAULT false,
	"cooldown_minutes" integer DEFAULT 60,
	"digest_enabled" boolean DEFAULT true,
	"weekly_digest_enabled" boolean DEFAULT true,
	"weekly_digest_email" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"cover_image" text,
	"category" text,
	"tags" text[] DEFAULT '{}',
	"status" text DEFAULT 'draft',
	"author_id" text,
	"author_name" text,
	"meta_title" text,
	"meta_description" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coach_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"student_id" text NOT NULL,
	"trade_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coach_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"hourly_rate" integer,
	"currency" text DEFAULT 'USD',
	"available" boolean DEFAULT true,
	"contact_email" text,
	"experience_years" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coach_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"student_id" text NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "coach_student" (
	"id" serial PRIMARY KEY NOT NULL,
	"coach_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invite_token" text,
	"invited_at" timestamp DEFAULT now(),
	"accepted_at" timestamp,
	"removed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "cost_budget_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"monthly_budget" text NOT NULL,
	"alert_threshold" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "creator_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"background" text NOT NULL,
	"content_focus" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"is_verified" boolean DEFAULT false,
	"external_link" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "creator_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "daily_equity_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mt5_account_id" text,
	"date" timestamp NOT NULL,
	"equity" text NOT NULL,
	"balance" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_backups" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"storage_key" text,
	"size_bytes" integer,
	"duration_ms" integer,
	"is_monthly" boolean DEFAULT false NOT NULL,
	"trigger" text DEFAULT 'scheduled' NOT NULL,
	"error_message" text,
	"restore_verified_at" timestamp,
	"restore_verified_status" text,
	"restore_verified_message" text
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_provider_id" text NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "early_access_signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"source" text DEFAULT 'landing_page',
	"status" text DEFAULT 'pending',
	"registered_user_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text,
	"user_id" text,
	"track" text NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_send_at" timestamp NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "founding_member_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending',
	"admin_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hub_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hub_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"symbol" text,
	"image_url" text,
	"type" text DEFAULT 'Idea' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hub_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "instrument_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"symbol" text NOT NULL,
	"analysis_text" text NOT NULL,
	"trade_count" integer DEFAULT 0,
	"win_rate" text,
	"avg_profit_loss" text,
	"total_profit_loss" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb,
	"utm_source" text,
	"utm_campaign" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_bookmarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manual_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount" text NOT NULL,
	"frequency" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_ad_strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"campaign_type" text NOT NULL,
	"objective" text,
	"audience_targeting" jsonb DEFAULT '{}'::jsonb,
	"budget_strategy" jsonb DEFAULT '{}'::jsonb,
	"bid_strategy" text,
	"ad_copy_ids" text[] DEFAULT '{}',
	"optimization_rules" jsonb DEFAULT '{}'::jsonb,
	"performance_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_brand_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"description" text,
	"target_audience_personas" jsonb DEFAULT '[]'::jsonb,
	"unique_selling_points" jsonb DEFAULT '[]'::jsonb,
	"competitors" jsonb DEFAULT '[]'::jsonb,
	"brand_voice" text,
	"brand_tone" text,
	"colors" jsonb DEFAULT '[]'::jsonb,
	"key_messages" jsonb DEFAULT '[]'::jsonb,
	"content_pipeline" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"budget" text,
	"target_audience" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"platform" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"hook" text,
	"cta" text,
	"hashtags" text,
	"topic_tags" text[] DEFAULT '{}',
	"framework_used" text,
	"campaign_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"performance_rating" integer,
	"ai_model_used" text,
	"scheduled_date" timestamp,
	"repurposed_from" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_email_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"name" text NOT NULL,
	"subject_line" text NOT NULL,
	"body" text NOT NULL,
	"recipient_segment" text DEFAULT 'all_users' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_count" integer DEFAULT 0,
	"open_rate" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mt5_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text,
	"broker" text,
	"server" text,
	"currency" text DEFAULT 'USD',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mt5_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mt5_account_id" text,
	"balance" text NOT NULL,
	"equity" text NOT NULL,
	"margin" text NOT NULL,
	"free_margin" text NOT NULL,
	"margin_level" text NOT NULL,
	"floating_pl" text NOT NULL,
	"leverage" integer DEFAULT 100,
	"currency" text DEFAULT 'USD',
	"positions" jsonb DEFAULT '[]'::jsonb,
	"sync_token" text NOT NULL,
	"last_update" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mt5_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mt5_account_id" text,
	"ticket" text NOT NULL,
	"symbol" text NOT NULL,
	"direction" text NOT NULL,
	"volume" text NOT NULL,
	"entry_price" text NOT NULL,
	"exit_price" text NOT NULL,
	"sl" text,
	"tp" text,
	"open_time" timestamp NOT NULL,
	"close_time" timestamp NOT NULL,
	"duration" integer,
	"gross_pl" text NOT NULL,
	"commission" text DEFAULT '0',
	"swap" text DEFAULT '0',
	"net_pl" text NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}',
	"mood" text,
	"mistake_category" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"link_url" text,
	"channel_in_app" boolean DEFAULT true,
	"channel_email" boolean DEFAULT false,
	"email_sent" boolean DEFAULT false,
	"read_at" timestamp,
	"dedupe_key" text,
	"cooldown_until" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_disclaimer" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"disclaimer_version" text NOT NULL,
	"disclaimer_text" text NOT NULL,
	"accepted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prop_firm_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"firm_name" text NOT NULL,
	"challenge_name" text NOT NULL,
	"phase" text DEFAULT 'Phase 1' NOT NULL,
	"account_size" text NOT NULL,
	"currency" text DEFAULT 'USD',
	"profit_target" text NOT NULL,
	"daily_drawdown_limit" text NOT NULL,
	"max_drawdown_limit" text NOT NULL,
	"trailing_drawdown" boolean DEFAULT false,
	"drawdown_type" text DEFAULT 'static',
	"trailing_stop_behavior" text DEFAULT 'always_trails',
	"phase_link" boolean DEFAULT false,
	"min_trading_days" integer DEFAULT 0,
	"max_trading_days" integer,
	"consistency_rule" boolean DEFAULT false,
	"max_day_profit_percent" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"current_balance" text,
	"high_water_mark" text,
	"mt5_account_id" text,
	"mt5_auto_sync" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prop_firm_daily_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"starting_balance" text NOT NULL,
	"ending_balance" text NOT NULL,
	"day_pl" text NOT NULL,
	"trades_count" integer DEFAULT 0,
	"daily_drawdown_used" text,
	"high_water_mark" text
);
--> statement-breakpoint
CREATE TABLE "provider_subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"receiver_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"subscription_status" text NOT NULL,
	"external_platform" text,
	"external_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "quiz_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" integer NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"recipient" varchar,
	"subject" varchar NOT NULL,
	"template_name" varchar,
	"success" boolean DEFAULT true,
	"error_message" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signal_provider_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_name" text NOT NULL,
	"bio" text,
	"win_rate" text DEFAULT '0',
	"subscriber_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "signal_receiver" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"receiver_name" text NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategy_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"strategy_id" integer NOT NULL,
	"category" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"rule_type" text NOT NULL,
	"options" jsonb,
	"default_value" text,
	"is_required" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trade_compliance_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"trade_id" integer NOT NULL,
	"strategy_id" integer NOT NULL,
	"strategy_name" text NOT NULL,
	"user_id" text NOT NULL,
	"overall_compliant" boolean NOT NULL,
	"rules_evaluated" integer DEFAULT 0,
	"rules_passed" integer DEFAULT 0,
	"evaluated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trade_journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT 'dev-user' NOT NULL,
	"pair" text NOT NULL,
	"direction" text NOT NULL,
	"timeframe" text NOT NULL,
	"htf_bias" text NOT NULL,
	"htf_bias_clear" boolean DEFAULT true,
	"zone_valid" boolean DEFAULT true,
	"zone_validity" text DEFAULT 'Valid',
	"liquidity_taken" boolean DEFAULT true,
	"liquidity_status" text DEFAULT 'Taken',
	"structure_confirmed" boolean DEFAULT true,
	"structure_state" text DEFAULT 'BOS',
	"entry_confirmed" boolean DEFAULT true,
	"entry_price" text,
	"stop_loss" text,
	"take_profit" text,
	"risk_reward" text,
	"net_pl" text,
	"outcome" text NOT NULL,
	"notes" text,
	"is_rule_compliant" boolean DEFAULT true,
	"violation_reason" text,
	"matched_setup" text,
	"mood" text,
	"mistake_category" text,
	"chart_url" text,
	"ai_tags" jsonb DEFAULT '[]'::jsonb,
	"chart_annotations" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trade_rule_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"compliance_result_id" integer NOT NULL,
	"rule_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"rule_label" text NOT NULL,
	"expected_value" jsonb,
	"actual_value" jsonb,
	"passed" boolean NOT NULL,
	"violation_reason" text
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now(),
	"progress" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"password" text,
	"role" text NOT NULL,
	"full_name" text,
	"terms_accepted" boolean DEFAULT false,
	"risk_acknowledged" boolean DEFAULT false,
	"subscription_tier" text DEFAULT 'FREE',
	"subscription_status" text,
	"current_plan" text,
	"renewal_date" timestamp,
	"paypal_subscription_id" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_provider" text,
	"billing_period" text,
	"sync_token" text,
	"country" text,
	"phone_number" text,
	"timezone" text,
	"must_reset_password" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"email_verification_token" text,
	"email_verification_expiry" timestamp,
	"password_reset_token" text,
	"password_reset_expiry" timestamp,
	"has_seen_tour" boolean DEFAULT false,
	"founding_member" boolean DEFAULT false,
	"founding_member_pro_expiry" timestamp,
	"dashboard_config" jsonb,
	"referral_code" text,
	"referred_by" text,
	"utm_source" text,
	"utm_campaign" text,
	"email_unsubscribed" boolean DEFAULT false,
	"unsubscribe_token" text,
	"language" text DEFAULT 'en',
	"last_login_at" timestamp,
	"admin_notes" text,
	"admin_tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"streak_type" text NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity_date" timestamp,
	"total_xp" integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_unique_slug" ON "blog_posts" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "mt5_history_unique_ticket" ON "mt5_history" USING btree ("user_id","mt5_account_id","ticket");
--> statement-breakpoint
CREATE TABLE "session" (
  "sid" varchar NOT NULL,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" ("expire");