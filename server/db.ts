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
    `);
    
    // Create early access signups table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS early_access_signups (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT,
        source TEXT DEFAULT 'landing_page',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Schema columns verified');
  } catch (error) {
    console.error('Schema migration error:', error);
  }
}
