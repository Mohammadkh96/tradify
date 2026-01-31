import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use Neon database if available, otherwise fall back to Replit's database
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

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
