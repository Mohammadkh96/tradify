import { defineConfig } from "drizzle-kit";
import path from "path";
import { env } from "@workspace/config";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: env.databaseUrl,
  },
});
