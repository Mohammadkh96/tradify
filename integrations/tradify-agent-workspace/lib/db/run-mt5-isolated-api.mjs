import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const databaseName = process.env.MT5_DEMO_DATABASE_NAME ?? "tradify_mt5_demo";
const baseUrl = process.env.DATABASE_URL;

if (!/^tradify_mt5_demo(?:_[a-z0-9_]+)?$/.test(databaseName)) {
  throw new Error(
    "MT5_DEMO_DATABASE_NAME must use the tradify_mt5_demo prefix and lowercase letters, numbers, or underscores.",
  );
}

function assertDevelopment() {
  if (process.env.MT5_ISOLATED_API !== "1" || process.env.APP_ENV === "production") {
    throw new Error("Refusing isolated MT5 API startup outside the explicitly enabled development workflow.");
  }
  process.env.NODE_ENV = "development";
  process.env.APP_ENV = "development";
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with status ${code}`)),
    );
  });
}

function targetDatabaseUrl() {
  const url = new URL(baseUrl);
  if (url.pathname !== "/heliumdb") {
    throw new Error("The isolated MT5 API may only derive from Replit's verified heliumdb development database.");
  }
  url.pathname = `/${databaseName}`;
  url.searchParams.set("application_name", "tradify-mt5-isolated-development");
  return url.toString();
}

async function main() {
  assertDevelopment();
  if (!baseUrl) throw new Error("Replit development DATABASE_URL is missing.");
  const mode = process.argv[2] ?? "serve";
  if (!["prepare", "serve", "cleanup"].includes(mode)) {
    throw new Error("Usage: run-mt5-isolated-api.mjs [prepare|serve|cleanup --confirm-delete-disposable-db]");
  }

  const targetUrl = targetDatabaseUrl();
  const testEnv = {
    ...process.env,
    NODE_ENV: "development",
    APP_ENV: "development",
    MT5_DEMO_DATABASE_NAME: databaseName,
    DATABASE_URL: targetUrl,
    PGDATABASE: databaseName,
  };
  delete testEnv.NEON_DATABASE_URL;
  delete testEnv.NEON_DEVELOPMENT_DATABASE_URL;

  const provisionUrl = new URL(baseUrl);
  provisionUrl.pathname = "/postgres";
  provisionUrl.searchParams.set("application_name", "tradify-mt5-isolated-provisioner");
  const developmentCheck = new Pool({ connectionString: baseUrl, max: 1 });
  const provisioner = new Pool({ connectionString: provisionUrl.toString(), max: 1 });
  let server;
  try {
    const { rows: developmentRows } = await developmentCheck.query(
      "SELECT current_database() AS name, pg_is_in_recovery() AS replica",
    );
    if (developmentRows[0]?.name !== "heliumdb" || developmentRows[0]?.replica) {
      throw new Error("Refusing setup: the source connection is not Replit's writable heliumdb development database.");
    }
    const { rows } = await provisioner.query(
      "SELECT current_database() AS name, pg_is_in_recovery() AS replica, (SELECT rolcreatedb FROM pg_roles WHERE rolname=current_user) AS can_create_database",
    );
    if (rows[0]?.name !== "postgres" || rows[0]?.replica || rows[0]?.can_create_database !== true) {
      throw new Error("Isolated MT5 database provisioning requires the writable Replit development PostgreSQL maintenance database.");
    }
    const existing = await provisioner.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (mode === "cleanup") {
      if (process.argv[3] !== "--confirm-delete-disposable-db") {
        throw new Error("Cleanup refused. Pass --confirm-delete-disposable-db to drop only tradify_mt5_demo.");
      }
      if (existing.rowCount > 0) {
        await provisioner.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [databaseName],
        );
        await provisioner.query(`DROP DATABASE "${databaseName}"`);
        console.log("Dropped disposable database: tradify_mt5_demo");
      } else {
        console.log("Disposable database was already absent.");
      }
      return;
    }
    if (existing.rowCount === 0) {
      await provisioner.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Created isolated disposable database: ${databaseName}`);
    } else {
      console.log(`Reusing isolated disposable database: ${databaseName}`);
    }

    await run("pnpm", ["--filter", "@workspace/db", "run", "push-force"], testEnv);
    if (mode === "prepare") {
      const verifyPool = new Pool({ connectionString: targetUrl, max: 1 });
      try {
        const verification = await verifyPool.query(
          "SELECT current_database() AS name, pg_is_in_recovery() AS replica",
        );
        if (verification.rows[0]?.name !== databaseName || verification.rows[0]?.replica) {
          throw new Error("Disposable MT5 database verification failed.");
        }
      } finally {
        await verifyPool.end();
      }
      console.log("Disposable MT5 database schema prepared and verified.");
      return;
    }
    if (!process.env.MT5_DEV_BRIDGE_SECRET) {
      throw new Error("MT5_DEV_BRIDGE_SECRET is missing; refusing to start the isolated MT5 API without its own bridge credential.");
    }
    await run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], testEnv);

    const api = spawn(process.execPath, ["--enable-source-maps", "artifacts/api-server/dist/index.mjs"], {
      cwd: root,
      env: testEnv,
      stdio: "inherit",
    });
    server = api;
    const terminate = () => api.kill("SIGTERM");
    process.once("SIGINT", terminate);
    process.once("SIGTERM", terminate);
    await new Promise((resolve, reject) => {
      api.once("error", reject);
      api.once("close", (code, signal) => {
        process.removeListener("SIGINT", terminate);
        process.removeListener("SIGTERM", terminate);
        if (code === 0 || signal === "SIGTERM" || signal === "SIGINT") resolve();
        else reject(new Error(`Isolated MT5 API exited with code ${code ?? "null"} (${signal ?? "no signal"}).`));
      });
    });
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) server.kill("SIGTERM");
    await developmentCheck.end();
    await provisioner.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Isolated MT5 API startup failed.");
  process.exitCode = 1;
});
