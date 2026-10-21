import assert from "node:assert/strict";
import test from "node:test";
import { env } from "./index";

const previous = new Map<string, string | undefined>();
const managedKeys = [
  "NODE_ENV",
  "DATABASE_URL",
  "NEON_DATABASE_URL",
  "NEON_DEVELOPMENT_DATABASE_URL",
  "MT5_DEMO_DATABASE_NAME",
  "MT5_BRIDGE_SECRET",
  "MT5_DEV_BRIDGE_SECRET",
];
for (const key of managedKeys) previous.set(key, process.env[key]);

test("isolated MT5 development mode requires its separate secret and never falls back", () => {
  try {
    process.env.NODE_ENV = "development";
    delete process.env.MT5_DEMO_DATABASE_NAME;
    process.env.MT5_BRIDGE_SECRET = "shared-test-fixture";
    process.env.MT5_DEV_BRIDGE_SECRET = "isolated-test-fixture";
    assert.equal(env.mt5BridgeSecret, "shared-test-fixture");

    process.env.MT5_DEMO_DATABASE_NAME = "tradify_mt5_demo";
    assert.equal(env.mt5BridgeSecret, "isolated-test-fixture");
    delete process.env.MT5_DEV_BRIDGE_SECRET;
    assert.equal(env.mt5BridgeSecret, undefined);

    process.env.NODE_ENV = "production";
    assert.throws(() => env.mt5BridgeSecret, /available only in development/);
  } finally {
    for (const key of managedKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("runtime database prefers the development-only Neon secret and preserves production DATABASE_URL", () => {
  try {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://replit.example/neondb";
    process.env.NEON_DATABASE_URL = "postgresql://neon.example/neondb";
    process.env.NEON_DEVELOPMENT_DATABASE_URL = "postgresql://neon-dev.example/neondb";
    assert.equal(env.runtimeDatabaseUrl, "postgresql://neon-dev.example/neondb");

    delete process.env.NEON_DEVELOPMENT_DATABASE_URL;
    assert.equal(env.runtimeDatabaseUrl, "postgresql://neon.example/neondb");
    assert.equal(env.databaseUrl, "postgresql://replit.example/neondb");

    process.env.NODE_ENV = "production";
    assert.equal(env.runtimeDatabaseUrl, "postgresql://replit.example/neondb");
    delete process.env.DATABASE_URL;
    assert.throws(() => env.runtimeDatabaseUrl, /DATABASE_URL must be set for production/);

    process.env.NODE_ENV = "development";
    process.env.NEON_DEVELOPMENT_DATABASE_URL = "postgresql://neon-dev.example/neondb";
    assert.equal(env.runtimeDatabaseUrl, "postgresql://neon-dev.example/neondb");
    delete process.env.NEON_DATABASE_URL;
    assert.equal(env.runtimeDatabaseUrl, "postgresql://neon-dev.example/neondb");

    delete process.env.NEON_DEVELOPMENT_DATABASE_URL;
    assert.throws(() => env.runtimeDatabaseUrl, /NEON_DEVELOPMENT_DATABASE_URL/);
  } finally {
    for (const key of managedKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
