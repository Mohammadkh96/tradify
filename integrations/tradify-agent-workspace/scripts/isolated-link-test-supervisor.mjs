import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  calculateEffectiveTestDeadline,
  createSignalsSessionExpiry,
  enforceDeadline,
  isSupportedJournalTestKid,
} from "./isolated-link-test-session.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "lib/db/package.json"));
const { Pool } = require("pg");
const SIGNALS_ISSUER = "https://linking-dev.signals.tradifyapp.com";
const SIGNALS_AUDIENCE = "tradify-journal-link-v1-dev";
const JOURNAL_ISSUER = "https://linking-dev.journal.tradifyapp.com";
const SIGNALS_INBOUND_AUDIENCE = "tradify-signals-link-v1-dev";
const PORT = Number(process.env.PORT);
const DEV_ORIGIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "unknown";
const SESSION_STARTED_AT = Date.now();
const DURATION_MINUTES = process.env.TRADIFY_LINK_TEST_DURATION_MINUTES === undefined
  ? 60
  : Number(process.env.TRADIFY_LINK_TEST_DURATION_MINUTES);
const SIGNALS_EXPIRES_AT = createSignalsSessionExpiry(SESSION_STARTED_AT, DURATION_MINUTES);
const SIGNALS_EXPIRY_MS = Date.parse(SIGNALS_EXPIRES_AT);
let effectiveDeadlineMs = SIGNALS_EXPIRY_MS;

if (!Number.isInteger(PORT) || PORT < 1) throw new Error("Workflow PORT is unavailable.");

const pair = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SIGNALS_KID = `signals-link-test-${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z-${crypto.randomBytes(6).toString("hex")}`;
const phaseASelfTestMessage = Buffer.from("tradify-isolated-signals-phase-a-self-test");
const phaseASelfTestSignature = crypto.sign("RSA-SHA256", phaseASelfTestMessage, pair.privateKey);
if (!crypto.verify("RSA-SHA256", phaseASelfTestMessage, pair.publicKey, phaseASelfTestSignature)) {
  throw new Error("Phase A signer self-test failed.");
}

for (const key of [
  "DATABASE_URL", "PGDATABASE", "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD",
  "NEON_DATABASE_URL", "NEON_DEVELOPMENT_DATABASE_URL",
]) delete process.env[key];

const controlRoot = fs.mkdtempSync("/tmp/tradify-link-supervisor-");
fs.chmodSync(controlRoot, 0o700);
const socketPath = path.join(controlRoot, "phase-b.sock");
const tempRoot = path.join(controlRoot, "postgres");
const dataDir = path.join(tempRoot, "data");
const socketDir = path.join(tempRoot, "socket");
let phase = "A";
let pinServer;
let statusServer;
let child;
let databasePool;
let pgStarted = false;
let cleaning = false;
let cancelSessionDeadline;

const report = (name, passed) => {
  console.log(`ISOLATED_LINK_CHECK ${name}=${passed ? "PASS" : "FAIL"}`);
  return Boolean(passed);
};
const isLoopback = (address) =>
  typeof address === "string" && address.split("/")[0] === "127.0.0.1";
const executable = (name) => execFileSync("which", [name], { encoding: "utf8" }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  if (pinServer) await new Promise((resolve) => pinServer.close(resolve));
  if (statusServer?.listening) await new Promise((resolve) => statusServer.close(resolve));
  cancelSessionDeadline?.();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 15_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await databasePool?.end().catch(() => {});
  if (pgStarted) {
    try {
      execFileSync(executable("pg_ctl"), ["-D", dataDir, "-m", "fast", "-w", "stop"], {
        stdio: "ignore",
      });
    } catch {
      console.error("ISOLATED_LINK_LOCAL_POSTGRES_STOP=FAIL");
    }
  }
  fs.rmSync(controlRoot, { recursive: true, force: true });
}

process.once("SIGTERM", () => void cleanup().finally(() => process.exit(0)));
process.once("SIGINT", () => void cleanup().finally(() => process.exit(0)));

function validatePeerPin(pin) {
  effectiveDeadlineMs = calculateEffectiveTestDeadline({
    signalsExpiresAt: SIGNALS_EXPIRES_AT,
    journalExpiresAt: pin.journalExpiresAt,
  });
  if (pin.phase !== "A_READY" || pin.privateKeyRetained !== true) {
    throw new Error("Journal has not confirmed its Phase A signer is retained in memory.");
  }
  if (pin.issuer !== JOURNAL_ISSUER || pin.audience !== SIGNALS_INBOUND_AUDIENCE) {
    throw new Error("Journal issuer/audience do not match the Signals verification policy.");
  }
  if (!isSupportedJournalTestKid(pin.kid)) {
    throw new Error("Journal key ID is missing or malformed.");
  }
  if (typeof pin.origin !== "string") throw new Error("Journal HTTPS origin is missing.");
  const origin = new URL(pin.origin);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Journal origin must be a bare HTTPS origin.");
  }
  const publicKey = crypto.createPublicKey(pin.publicPem);
  if (
    publicKey.asymmetricKeyType !== "rsa" ||
    (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  ) throw new Error("Journal public key must be RSA-2048 or stronger.");
}

async function createLocalDatabase() {
  fs.mkdirSync(socketDir, { recursive: true });
  execFileSync(executable("initdb"), [
    "-D", dataDir, "-U", "postgres", "--auth-local=trust", "--auth-host=trust",
    "--no-instructions",
  ], { stdio: "ignore" });
  const serverPort = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const value = probe.address().port;
      probe.close((error) => error ? reject(error) : resolve(value));
    });
  });
  execFileSync(executable("pg_ctl"), [
    "-D", dataDir, "-o",
    `-h 127.0.0.1 -p ${serverPort} -k ${socketDir} -c listen_addresses=127.0.0.1`,
    "-w", "start",
  ], { stdio: "ignore" });
  pgStarted = true;
  const admin = new Pool({
    connectionString: `postgresql://postgres@127.0.0.1:${serverPort}/postgres`,
    max: 1,
  });
  const check = await admin.query(
    "SELECT current_database() AS name, inet_server_addr()::text AS address",
  );
  if (
    !report("phase_b_loopback_postgres", check.rows[0]?.name === "postgres" &&
      isLoopback(check.rows[0]?.address))
  ) throw new Error("Local PostgreSQL loopback check failed.");

  const databaseName = `tradify_test_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();
  const databaseUrl =
    `postgresql://postgres@127.0.0.1:${serverPort}/${databaseName}?application_name=tradify-link-isolated`;
  const target = new Pool({ connectionString: databaseUrl, max: 1 });
  const targetCheck = await target.query(
    "SELECT current_database() AS name, inet_server_addr()::text AS address",
  );
  const passed =
    targetCheck.rows[0]?.name === databaseName &&
    isLoopback(targetCheck.rows[0]?.address) &&
    /^tradify_test_[0-9]+_[a-f0-9]{8}$/.test(databaseName);
  await target.end();
  if (!report("phase_b_disposable_database", passed)) {
    throw new Error("Disposable database check failed.");
  }
  return { databaseUrl, databaseName, serverPort };
}

async function startApi(pin) {
  phase = "B";
  await new Promise((resolve) => statusServer.close(resolve));
  const { databaseUrl, databaseName, serverPort } = await createLocalDatabase();
  const apiEnv = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "/tmp",
    NODE_ENV: "development",
    APP_ENV: "development",
    PORT: String(PORT),
    ...(process.env.BASE_PATH ? { BASE_PATH: process.env.BASE_PATH } : {}),
    ...(process.env.REPLIT_DEV_DOMAIN ? { REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN } : {}),
    DATABASE_URL: databaseUrl,
    PGHOST: "127.0.0.1",
    PGPORT: String(serverPort),
    PGUSER: "postgres",
    PGDATABASE: databaseName,
    TRADIFY_ACCOUNT_LINKING_ENABLED: "true",
    TRADIFY_ACCOUNT_LINKING_TEST_MODE: "true",
    TRADIFY_LINK_TEST_DEADLINE: new Date(effectiveDeadlineMs).toISOString(),
    SIGNALS_LINKING_ISSUER: SIGNALS_ISSUER,
    JOURNAL_LINKING_ISSUER: JOURNAL_ISSUER,
    SIGNALS_LINKING_AUDIENCE: SIGNALS_AUDIENCE,
    JOURNAL_LINKING_AUDIENCE: SIGNALS_INBOUND_AUDIENCE,
    SIGNALS_LINKING_KEY_ID: SIGNALS_KID,
    JOURNAL_LINKING_KEY_ID: pin.kid,
    SIGNALS_LINKING_PRIVATE_KEY: pair.privateKey,
    JOURNAL_LINKING_PUBLIC_KEY: pin.publicPem,
    JOURNAL_LINK_API_URL: pin.origin,
    SESSION_SECRET: crypto.randomBytes(32).toString("base64url"),
    MT5_BRIDGE_SECRET: crypto.randomBytes(32).toString("hex"),
    LOG_LEVEL: "info",
    DOTENV_CONFIG_PATH: "/dev/null",
  };
  const migration = spawn("pnpm", ["--filter", "@workspace/db", "run", "push-force"], {
    cwd: root,
    env: apiEnv,
    stdio: "inherit",
  });
  child = migration;
  const migrationExit = await new Promise((resolve, reject) => {
    migration.once("error", reject);
    migration.once("exit", resolve);
  });
  if (child === migration) child = undefined;
  if (migrationExit !== 0) throw new Error("Disposable-only schema setup failed.");

  databasePool = new Pool({ connectionString: databaseUrl, max: 1 });
  const postMigration = await databasePool.query(
    "SELECT current_database() AS name, inet_server_addr()::text AS address",
  );
  if (
    postMigration.rows[0]?.name !== databaseName ||
    !isLoopback(postMigration.rows[0]?.address)
  ) throw new Error("Post-migration local DB verification failed.");
  await databasePool.end();
  databasePool = undefined;

  const apiDir = path.join(root, "artifacts/api-server");
  child = spawn(process.execPath, [
    path.join(root, "node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs"),
    path.join(apiDir, "src/isolated-link-test-bootstrap.ts"),
  ], { cwd: apiDir, env: apiEnv, stdio: "inherit" });
  const deadline = Date.now() + 60_000;
  let healthy = false;
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 200) {
        healthy = true;
        break;
      }
    } catch { /* wait for API startup */ }
    await delay(500);
  }
  if (!healthy) throw new Error("Phase B API did not pass the local health check.");
  console.log(
    `ISOLATED_LINK_PHASE_B_READY origin=${DEV_ORIGIN} ` +
    `signals_expires_at=${SIGNALS_EXPIRES_AT} ` +
    `journal_expires_at=${pin.journalExpiresAt} ` +
    `effective_expires_at=${new Date(effectiveDeadlineMs).toISOString()}`,
  );
  await new Promise((resolve) => child.once("exit", resolve));
}

async function receivePeerPin() {
  return new Promise((resolve, reject) => {
    pinServer = net.createServer((connection) => {
      let contents = "";
      connection.setEncoding("utf8");
      connection.on("data", (part) => {
        contents += part;
        if (contents.length > 16_384) {
          connection.destroy(new Error("Pin message exceeded the allowed size."));
          reject(new Error("Pin message exceeded the allowed size."));
        }
        const newline = contents.indexOf("\n");
        if (newline !== -1) {
          try {
            const pin = JSON.parse(contents.slice(0, newline));
            validatePeerPin(pin);
            connection.end("PIN_RECEIVED\n");
            resolve(pin);
          } catch (error) {
            connection.end("PIN_REJECTED\n");
            reject(error);
          }
        }
      });
    });
    pinServer.once("error", reject);
    pinServer.listen(socketPath, () => {
      fs.chmodSync(socketPath, 0o600);
    });
  });
}

statusServer = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health" && phase === "A") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({
      status: "ready",
      phase,
      signalsExpiresAt: SIGNALS_EXPIRES_AT,
      expiresAt: new Date(effectiveDeadlineMs).toISOString(),
    }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});
statusServer.listen(PORT, "0.0.0.0");
await new Promise((resolve, reject) => {
  statusServer.once("listening", resolve);
  statusServer.once("error", reject);
});

console.log(
  `ISOLATED_LINK_PHASE_A_READY origin=${DEV_ORIGIN} ` +
  `signals_expires_at=${SIGNALS_EXPIRES_AT} duration_minutes=${DURATION_MINUTES}`,
);
console.log("ISOLATED_LINK_CHECK phase_a_signer_pair=PASS");
console.log(`SIGNALS_ISSUER=${SIGNALS_ISSUER}`);
console.log(`SIGNALS_AUDIENCE=${SIGNALS_AUDIENCE}`);
console.log(`SIGNALS_LINKING_KEY_ID=${SIGNALS_KID}`);
console.log(`SIGNALS_PUBLIC_PEM_BEGIN\n${pair.publicKey.trim()}\nSIGNALS_PUBLIC_PEM_END`);
console.log(`PHASE_B_LOCAL_CONTROL_SOCKET=${socketPath}`);

try {
  const pin = await Promise.race([
    receivePeerPin(),
    delay(Math.max(0, SIGNALS_EXPIRY_MS - Date.now())).then(() => {
      throw new Error("Phase A expired before Journal's Phase A pin arrived.");
    }),
  ]);
  cancelSessionDeadline = enforceDeadline(effectiveDeadlineMs, () => {
    console.log("ISOLATED_LINK_SESSION_DEADLINE_REACHED=1");
    void cleanup().finally(() => process.exit(0));
  });
  await startApi(pin);
} catch (error) {
  console.error(`ISOLATED_LINK_SUPERVISOR_STOPPED reason=${error.message}`);
} finally {
  await cleanup();
}
