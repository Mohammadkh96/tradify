import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Clean connection string - remove psql command wrapper if present
function cleanConnectionString(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Remove "psql '" prefix and trailing "'" if present
  let cleaned = url.trim();
  if (cleaned.startsWith("psql ")) {
    cleaned = cleaned.replace(/^psql\s+['"]?/, "").replace(/['"]$/, "");
  }
  return cleaned;
}

// Use Neon database if available, otherwise fall back to Replit's database
const connectionString = cleanConnectionString(process.env.NEON_DATABASE_URL) || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or NEON_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log which database is being used (without exposing credentials)
const isNeon = !!process.env.NEON_DATABASE_URL;
console.log(`Using ${isNeon ? 'Neon' : 'Replit'} PostgreSQL database`);

// Neon requires SSL
export const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});
export const db = drizzle(pool, { schema });

// Auto-migrate: ensure all required columns exist
export async function ensureSchemaColumns() {
  try {
    // Add all potentially missing columns
    await pool.query(`
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT false;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS full_name TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS has_seen_tour BOOLEAN DEFAULT false;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS founding_member BOOLEAN DEFAULT false;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS founding_member_pro_expiry TIMESTAMP;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS dashboard_config JSONB;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly';
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS referral_code TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS referred_by TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMP;
      ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS mood TEXT;
      ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS mistake_category TEXT;
      ALTER TABLE mt5_history ADD COLUMN IF NOT EXISTS mood TEXT;
      ALTER TABLE mt5_history ADD COLUMN IF NOT EXISTS mistake_category TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS utm_source TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN DEFAULT false;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;
      ALTER TABLE user_role ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
    `);

    // Create sent_emails table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sent_emails (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        template_name TEXT,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create early access signups table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS early_access_signups (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT,
        source TEXT DEFAULT 'landing_page',
        status TEXT DEFAULT 'pending',
        registered_user_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Add registered_user_id column if missing (for existing tables)
    await pool.query(`
      ALTER TABLE early_access_signups ADD COLUMN IF NOT EXISTS registered_user_id TEXT;
    `);

    // Create prop firm challenges table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prop_firm_challenges (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        firm_name TEXT NOT NULL,
        challenge_name TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'Phase 1',
        account_size TEXT NOT NULL,
        currency TEXT DEFAULT 'USD',
        profit_target TEXT NOT NULL,
        daily_drawdown_limit TEXT NOT NULL,
        max_drawdown_limit TEXT NOT NULL,
        trailing_drawdown BOOLEAN DEFAULT false,
        drawdown_type TEXT DEFAULT 'static',
        trailing_stop_behavior TEXT DEFAULT 'always_trails',
        phase_link BOOLEAN DEFAULT false,
        min_trading_days INTEGER DEFAULT 0,
        max_trading_days INTEGER,
        consistency_rule BOOLEAN DEFAULT false,
        max_day_profit_percent TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'active',
        current_balance TEXT,
        high_water_mark TEXT,
        mt5_account_id TEXT,
        mt5_auto_sync BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create prop firm daily stats table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prop_firm_daily_stats (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        date TIMESTAMP NOT NULL,
        starting_balance TEXT NOT NULL,
        ending_balance TEXT NOT NULL,
        day_pl TEXT NOT NULL,
        trades_count INTEGER DEFAULT 0,
        daily_drawdown_used TEXT,
        high_water_mark TEXT
      );
    `);

    // Create leads table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        source TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(email, source)
      );
    `);

    // Create email drip sequences table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_sequences (
        id SERIAL PRIMARY KEY,
        email TEXT,
        user_id TEXT,
        track TEXT NOT NULL,
        current_step INTEGER NOT NULL DEFAULT 0,
        next_send_at TIMESTAMP NOT NULL,
        completed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Backfill existing free users into the drip sequence (idempotent — uses NOT EXISTS)
    try {
      const backfillResult = await pool.query(`
        INSERT INTO email_sequences (user_id, track, current_step, next_send_at, completed)
        SELECT u.user_id, 'free_user', 0, NOW(), false
        FROM user_role u
        WHERE UPPER(u.subscription_tier) = 'FREE'
          AND u.role = 'TRADER'
          AND NOT EXISTS (
            SELECT 1 FROM email_sequences e
            WHERE e.user_id = u.user_id AND e.track = 'free_user'
          )
      `);
      if (backfillResult.rowCount && backfillResult.rowCount > 0) {
        console.log(`[Startup] Backfilled ${backfillResult.rowCount} existing free user(s) into drip sequence`);
      }
    } catch (e) {
      console.error('[Startup] Drip backfill error:', e);
    }

    // Create founding member suggestions table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS founding_member_suggestions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create blog_posts table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        cover_image TEXT,
        category TEXT,
        tags TEXT[] DEFAULT '{}',
        status TEXT DEFAULT 'draft',
        author_id TEXT,
        author_name TEXT,
        meta_title TEXT,
        meta_description TEXT,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create unique index on blog_posts slug if not exists
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_unique_slug ON blog_posts (slug)`);
    } catch (e) {
      // Index may already exist
    }

    // Backfill NULL mt5_account_id values to 'default' so unique index works
    try {
      const backfillResult = await pool.query(`
        UPDATE mt5_history SET mt5_account_id = 'default' WHERE mt5_account_id IS NULL
      `);
      if (backfillResult.rowCount && backfillResult.rowCount > 0) {
        console.log(`[Startup] Backfilled ${backfillResult.rowCount} NULL mt5_account_id values`);
      }
    } catch (e) {
      // Table may not exist yet on first run
    }

    // Clean up duplicate MT5 history records (keep highest ID per user/account/ticket)
    try {
      const dupResult = await pool.query(`
        DELETE FROM mt5_history 
        WHERE id NOT IN (
          SELECT MAX(id) FROM mt5_history 
          GROUP BY user_id, mt5_account_id, ticket
        )
      `);
      if (dupResult.rowCount && dupResult.rowCount > 0) {
        console.log(`[Startup] Cleaned ${dupResult.rowCount} duplicate MT5 history records`);
      }
    } catch (e) {
      // Table may not exist yet on first run
    }

    // Ensure unique index on mt5_history for deduplication
    try {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS mt5_history_unique_ticket 
        ON mt5_history (user_id, mt5_account_id, ticket)
      `);
    } catch (e) {
      // Index may already exist
    }

    // Create marketing_brand_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_brand_settings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        description TEXT,
        target_audience_personas JSONB DEFAULT '[]',
        unique_selling_points JSONB DEFAULT '[]',
        competitors JSONB DEFAULT '[]',
        brand_voice TEXT,
        brand_tone TEXT,
        colors JSONB DEFAULT '[]',
        key_messages JSONB DEFAULT '[]',
        content_pipeline JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add content_pipeline column if missing (for existing tables)
    await pool.query(`
      ALTER TABLE marketing_brand_settings ADD COLUMN IF NOT EXISTS content_pipeline JSONB;
    `);

    // Create marketing_content table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_content (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        platform TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        hook TEXT,
        cta TEXT,
        hashtags TEXT,
        topic_tags TEXT[] DEFAULT '{}',
        framework_used TEXT,
        campaign_id INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        performance_rating INTEGER,
        ai_model_used TEXT,
        scheduled_date TIMESTAMP,
        repurposed_from INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add scheduled_date and repurposed_from columns if missing (for existing tables)
    await pool.query(`
      ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMP;
      ALTER TABLE marketing_content ADD COLUMN IF NOT EXISTS repurposed_from INTEGER;
    `);

    // Create marketing_campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        goal TEXT,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planning',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        budget TEXT,
        target_audience TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create marketing_ad_strategies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_ad_strategies (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        campaign_type TEXT NOT NULL,
        objective TEXT,
        audience_targeting JSONB DEFAULT '{}',
        budget_strategy JSONB DEFAULT '{}',
        bid_strategy TEXT,
        ad_copy_ids TEXT[] DEFAULT '{}',
        optimization_rules JSONB DEFAULT '{}',
        performance_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create marketing_email_sequences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_email_sequences (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        name TEXT NOT NULL,
        subject_line TEXT NOT NULL,
        body TEXT NOT NULL,
        recipient_segment TEXT NOT NULL DEFAULT 'all_users',
        status TEXT NOT NULL DEFAULT 'draft',
        sent_count INTEGER DEFAULT 0,
        open_rate TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create ai_usage_logs table for AI cost tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_tier TEXT NOT NULL,
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost_usd TEXT NOT NULL,
        request_duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create manual_costs table for fixed expense tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manual_costs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount TEXT NOT NULL,
        frequency TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create cost_budget_alerts table for budget thresholds
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cost_budget_alerts (
        id SERIAL PRIMARY KEY,
        monthly_budget TEXT NOT NULL,
        alert_threshold INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create user_achievements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        achievement_key TEXT NOT NULL,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        progress INTEGER DEFAULT 0
      );
    `);

    // Create user_streaks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        streak_type TEXT NOT NULL,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date TIMESTAMP,
        total_xp INTEGER DEFAULT 0
      );
    `);

    // Create database_backups table (for daily Neon backup observability)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS database_backups (
        id SERIAL PRIMARY KEY,
        run_at TIMESTAMP DEFAULT NOW() NOT NULL,
        status TEXT NOT NULL,
        storage_key TEXT,
        size_bytes INTEGER,
        duration_ms INTEGER,
        is_monthly BOOLEAN DEFAULT false NOT NULL,
        trigger TEXT DEFAULT 'scheduled' NOT NULL,
        error_message TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_database_backups_run_at ON database_backups (run_at DESC);
      CREATE INDEX IF NOT EXISTS idx_database_backups_status ON database_backups (status);
    `);

    // Create notifications table (for risk alerts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        link_url TEXT,
        channel_in_app BOOLEAN DEFAULT true,
        channel_email BOOLEAN DEFAULT false,
        email_sent BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        dedupe_key TEXT,
        cooldown_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications (user_id, dedupe_key);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;
    `);

    // Create alert_preferences table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_preferences (
        user_id TEXT PRIMARY KEY,
        drawdown_enabled BOOLEAN DEFAULT true,
        drawdown_in_app BOOLEAN DEFAULT true,
        drawdown_email BOOLEAN DEFAULT true,
        drawdown_warn_threshold INTEGER DEFAULT 70,
        drawdown_critical_threshold INTEGER DEFAULT 90,
        revenge_enabled BOOLEAN DEFAULT true,
        revenge_in_app BOOLEAN DEFAULT true,
        revenge_email BOOLEAN DEFAULT true,
        overtrading_enabled BOOLEAN DEFAULT true,
        overtrading_in_app BOOLEAN DEFAULT true,
        overtrading_email BOOLEAN DEFAULT false,
        overtrading_daily_cap INTEGER DEFAULT 10,
        strategy_deviation_enabled BOOLEAN DEFAULT true,
        strategy_deviation_in_app BOOLEAN DEFAULT true,
        strategy_deviation_email BOOLEAN DEFAULT false,
        cooldown_minutes INTEGER DEFAULT 60,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS drawdown_in_app BOOLEAN DEFAULT true;
      ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS revenge_in_app BOOLEAN DEFAULT true;
      ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS overtrading_in_app BOOLEAN DEFAULT true;
      ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS strategy_deviation_in_app BOOLEAN DEFAULT true;
      ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN DEFAULT true;
    `);

    console.log('Schema columns verified');
  } catch (error) {
    console.error('Schema migration error:', error);
  }
}
