import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname),
    include: ["server/**/*.{test,spec}.{ts,tsx}", "shared/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
});
