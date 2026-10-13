import { defineConfig } from "drizzle-kit";

if (!process.env.DEV_DATABASE_URL) {
  throw new Error("DEV_DATABASE_URL must point to an isolated development database.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DEV_DATABASE_URL,
  },
});
