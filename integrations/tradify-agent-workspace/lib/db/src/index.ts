import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@workspace/config";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.runtimeDatabaseUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
