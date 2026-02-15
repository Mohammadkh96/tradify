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
      ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS mood TEXT;
      ALTER TABLE trade_journal ADD COLUMN IF NOT EXISTS mistake_category TEXT;
      ALTER TABLE mt5_history ADD COLUMN IF NOT EXISTS mood TEXT;
      ALTER TABLE mt5_history ADD COLUMN IF NOT EXISTS mistake_category TEXT;
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

    // Backfill NULL mt5_account_id values to 'default' so unique index works
    try {
      const backfillResult = await pool.query(`
        UPDATE mt5_history SET mt5_account_id = 'default' WHERE mt5_account_id IS NULL
      `);
      if (backfillResult.rowCount && backfillResult.rowCount > 0) {
        console.log(`[Startup] Backfilled ${backfillResult.rowCount} NULL mt5_account_id values`);
      }
    } catch (e) {
      console.log('[Startup] MT5 account_id backfill skipped');
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
      console.log('[Startup] MT5 dedup cleanup skipped (table may not exist yet)');
    }

    // Drop old index if it exists (may have NULL issue), recreate cleanly
    try {
      await pool.query(`DROP INDEX IF EXISTS mt5_history_unique_ticket`);
      await pool.query(`
        CREATE UNIQUE INDEX mt5_history_unique_ticket 
        ON mt5_history (user_id, mt5_account_id, ticket)
      `);
    } catch (e) {
      // Index may already exist from a previous run
      console.log('[Startup] MT5 unique index already exists or creation skipped');
    }

    console.log('Schema columns verified');
  } catch (error) {
    console.error('Schema migration error:', error);
  }
}
