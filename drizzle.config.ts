import { defineConfig } from "drizzle-kit";
import { assertNotProductionDatabase } from "./server/dbTarget";

if (!process.env.DEV_DATABASE_URL) {
  throw new Error("DEV_DATABASE_URL must point to an isolated development database.");
}

assertNotProductionDatabase("DEV_DATABASE_URL", process.env.DEV_DATABASE_URL, [
  { name: "DATABASE_URL", connectionString: process.env.DATABASE_URL },
  { name: "NEON_DATABASE_URL", connectionString: process.env.NEON_DATABASE_URL },
]);

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DEV_DATABASE_URL,
  },
});
