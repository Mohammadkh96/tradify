import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { createServer } from "node:net";
import {
  chmodSync,
  existsSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  JOURNAL_DEV_ISSUER,
  JOURNAL_LINK_AUDIENCE,
  SIGNALS_DEV_ISSUER,
} from "../server/product-linking-assertions";

const SESSION_LIFETIME_MS = 180 * 60 * 1000;
const SESSION_MARKER = process.env.PHASEA_SESSION_MARKER;
const ROOT = process.env.PHASEA_ROOT;
const CONTROL_SOCKET = process.env.PHASEA_CONTROL_SOCKET;
const EXPECTED_JOURNAL_AUDIENCE = "tradify-signals-link-v1-dev";
const MAX_CONTROL_MESSAGE_BYTES = 16 * 1024;

type SessionMarker = {
  kid: string;
  expiresAt: string;
  status: "active" | "expired" | "stopped";
};

type PeerPin = {
  kid: string;
  publicKeyPem: string;
  issuer: string;
  audience: string;
  apiBaseUrl: string;
  expiresAt: string;
};

function requireIsolatedRuntime(): void {
  if (process.env.NODE_ENV !== "development" || process.env.APP_ENV !== "development") {
    throw new Error("Journal Phase A requires the isolated development runtime.");
  }
  if (
    !SESSION_MARKER ||
    !ROOT ||
    !CONTROL_SOCKET ||
    !path.resolve(CONTROL_SOCKET).startsWith(`${path.resolve(ROOT)}${path.sep}`)
  ) {
    throw new Error("Journal Phase A temporary runtime paths are invalid.");
  }
  if (existsSync(SESSION_MARKER)) {
    throw new Error("A previous Journal Phase A session marker exists; refusing to create a new signer.");
  }
  if (
    process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY ||
    process.env.TRADIFY_JOURNAL_PRIVATE_KEY ||
    process.env.NEON_DATABASE_URL ||
    process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Unexpected persistent key or database configuration in the isolated runtime.");
  }

  const localDatabase = new URL(process.env.DEV_DATABASE_URL ?? "");
  if (
    localDatabase.protocol !== "postgresql:" ||
    localDatabase.hostname !== "127.0.0.1" ||
    localDatabase.port !== "5562" ||
    localDatabase.pathname !== "/tradify_journal_dev" ||
    localDatabase.searchParams.get("sslmode") !== "verify-full"
  ) {
    throw new Error("Journal Phase A requires the disposable loopback PostgreSQL database.");
  }

  const productionGuard = new URL(process.env.DATABASE_URL ?? "");
  if (productionGuard.hostname !== "production.invalid") {
    throw new Error("Journal Phase A production fallback guard is missing.");
  }

  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (!domain || !domain.endsWith(".replit.dev") || process.env.APP_URL !== `https://${domain}`) {
    throw new Error("Journal Phase A requires the current HTTPS Replit development origin.");
  }
}

function writeSessionMarker(marker: SessionMarker): void {
  if (!SESSION_MARKER) throw new Error("Journal Phase A marker path is missing.");
  writeFileSync(SESSION_MARKER, `${JSON.stringify(marker)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
}

function updateSessionMarker(status: SessionMarker["status"]): void {
  if (!SESSION_MARKER || !existsSync(SESSION_MARKER)) return;
  try {
    const marker = JSON.parse(readFileSync(SESSION_MARKER, "utf8")) as SessionMarker;
    writeFileSync(SESSION_MARKER, `${JSON.stringify({ ...marker, status })}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Keep the marker fail-closed if its status cannot be updated.
  }
}

function parseFutureExpiry(value: unknown): number {
  if (typeof value !== "string") throw new Error("Peer session expiry must be a UTC timestamp.");
  const timestamp = Date.parse(value);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== value ||
    timestamp <= Date.now()
  ) {
    throw new Error("Peer session expiry must be a future canonical UTC timestamp.");
  }
  return timestamp;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validatePeerPin(value: Record<string, unknown>): PeerPin {
  if (!exactKeys(value, ["action", "kid", "publicKeyPem", "issuer", "audience", "apiBaseUrl", "expiresAt"])) {
    throw new Error("Peer pin request has an unexpected shape.");
  }
  if (
    typeof value.kid !== "string" ||
    value.kid.length < 1 ||
    value.kid.length > 128 ||
    typeof value.publicKeyPem !== "string" ||
    value.publicKeyPem.length > 8192 ||
    value.issuer !== SIGNALS_DEV_ISSUER ||
    value.audience !== JOURNAL_LINK_AUDIENCE ||
    typeof value.apiBaseUrl !== "string"
  ) {
    throw new Error("Peer public-key identity does not match the approved development contract.");
  }

  const peerKey = createPublicKey(value.publicKeyPem.replace(/\\n/g, "\n").trim());
  if (
    peerKey.asymmetricKeyType !== "rsa" ||
    (peerKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
  ) {
    throw new Error("Peer public key must be RSA-2048 or stronger.");
  }
  const apiBase = new URL(value.apiBaseUrl);
  if (
    apiBase.protocol !== "https:" ||
    apiBase.username ||
    apiBase.password ||
    apiBase.pathname !== "/" ||
    apiBase.search ||
    apiBase.hash
  ) {
    throw new Error("Peer API base must be an HTTPS origin without credentials or a path.");
  }
  parseFutureExpiry(value.expiresAt);

  return {
    kid: value.kid,
    publicKeyPem: value.publicKeyPem.replace(/\\n/g, "\n").trim(),
    issuer: value.issuer,
    audience: value.audience,
    apiBaseUrl: apiBase.origin,
    expiresAt: value.expiresAt,
  };
}

async function main(): Promise<void> {
  requireIsolatedRuntime();

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const publicPem = String(publicKey);
  const privatePem = String(privateKey);
  const publicDer = createPublicKey(publicPem).export({ type: "spki", format: "der" });
  const kid = `jrn-dev-${createHash("sha256").update(publicDer).digest("hex").slice(0, 32)}`;
  const issuedAt = Date.now();
  const expiresAt = new Date(issuedAt + SESSION_LIFETIME_MS).toISOString();

  const challenge = randomBytes(32);
  const signature = sign("RSA-SHA256", challenge, privatePem);
  if (!verify("RSA-SHA256", challenge, publicPem, signature)) {
    throw new Error("Journal Phase A signer self-verification failed.");
  }

  process.env.TRADIFY_JOURNAL_ISSUER = JOURNAL_DEV_ISSUER;
  process.env.TRADIFY_JOURNAL_AUDIENCE = EXPECTED_JOURNAL_AUDIENCE;
  process.env.TRADIFY_JOURNAL_KEY_ID = kid;
  process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY = privatePem;
  process.env.DEV_PRODUCT_LINKING_ENABLED = "false";
  delete process.env.TRADIFY_JOURNAL_PRIVATE_KEY;
  delete process.env.TRADIFY_SIGNALS_KEY_ID;
  delete process.env.TRADIFY_SIGNALS_PUBLIC_KEY;
  delete process.env.TRADIFY_SIGNALS_PREVIOUS_KEY_ID;
  delete process.env.TRADIFY_SIGNALS_PREVIOUS_PUBLIC_KEY;
  delete process.env.TRADIFY_SIGNALS_PREVIOUS_KEY_EXPIRES_AT;
  delete process.env.TRADIFY_SIGNALS_API_BASE_URL;

  writeSessionMarker({ kid, expiresAt, status: "active" });

  let peerPin: PeerPin | null = null;
  let effectiveDeadline = Date.parse(expiresAt);
  let linkingEnabled = false;
  let markerStatus: SessionMarker["status"] = "active";
  let expiryTimer: NodeJS.Timeout;

  const stopAtDeadline = (): void => {
    markerStatus = "expired";
    updateSessionMarker(markerStatus);
    console.info(`[journal-phase-a] Session expired at ${expiresAt}; stopping isolated runtime.`);
    process.exit(0);
  };
  const scheduleDeadline = (): void => {
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(stopAtDeadline, Math.max(0, effectiveDeadline - Date.now()));
  };
  scheduleDeadline();

  const controlServer = createServer((socket) => {
    let raw = "";
    let responded = false;
    const respond = (value: Record<string, unknown>): void => {
      if (responded) return;
      responded = true;
      socket.end(JSON.stringify(value));
    };
    const handleRequest = (request: Record<string, unknown>): void => {
      try {
        if (request.action === "status" && exactKeys(request, ["action"])) {
          respond({
            ok: true,
            kid,
            expiresAt,
            peerPinned: Boolean(peerPin),
            linkingEnabled,
            effectiveDeadline: new Date(effectiveDeadline).toISOString(),
          });
          return;
        }
        if (request.action === "pin-peer") {
          if (peerPin) throw new Error("A peer key is already pinned for this immutable session.");
          peerPin = validatePeerPin(request);
          process.env.TRADIFY_SIGNALS_ISSUER = peerPin.issuer;
          process.env.TRADIFY_SIGNALS_KEY_ID = peerPin.kid;
          process.env.TRADIFY_SIGNALS_PUBLIC_KEY = peerPin.publicKeyPem;
          process.env.TRADIFY_SIGNALS_API_BASE_URL = peerPin.apiBaseUrl;
          effectiveDeadline = Math.min(effectiveDeadline, Date.parse(peerPin.expiresAt));
          scheduleDeadline();
          respond({
            ok: true,
            peerPinned: true,
            linkingEnabled: false,
            effectiveDeadline: new Date(effectiveDeadline).toISOString(),
          });
          console.info(`[journal-phase-a] Signals public key pinned in memory; linking remains disabled until explicit activation.`);
          return;
        }
        if (request.action === "activate-phase-b" && exactKeys(request, ["action", "journalKid"])) {
          if (!peerPin) throw new Error("Signals public key must be pinned before Phase B.");
          if (request.journalKid !== kid) throw new Error("Phase B activation does not match this Journal kid.");
          if (effectiveDeadline <= Date.now()) throw new Error("The shared test-session deadline has passed.");
          process.env.DEV_PRODUCT_LINKING_ENABLED = "true";
          linkingEnabled = true;
          respond({
            ok: true,
            linkingEnabled: true,
            effectiveDeadline: new Date(effectiveDeadline).toISOString(),
          });
          console.info(`[journal-phase-a] Phase B activated for isolated development until ${new Date(effectiveDeadline).toISOString()}.`);
          return;
        }
        throw new Error("Unsupported local control action.");
      } catch (error) {
        respond({
          ok: false,
          error: error instanceof Error ? error.message : "Local control request failed.",
        });
      }
    };

    socket.setTimeout(5_000, () => {
      respond({ ok: false, error: "Local control request timed out." });
    });
    socket.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (Buffer.byteLength(raw, "utf8") > MAX_CONTROL_MESSAGE_BYTES) {
        respond({ ok: false, error: "Local control message is too large." });
        return;
      }
      const newline = raw.indexOf("\n");
      if (newline >= 0) {
        try {
          const parsed: unknown = JSON.parse(raw.slice(0, newline));
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Local control message must be a JSON object.");
          }
          handleRequest(parsed as Record<string, unknown>);
        } catch (error) {
          respond({ ok: false, error: error instanceof Error ? error.message : "Invalid control message." });
        }
      }
    });
    socket.on("end", () => {
      if (responded || !raw.trim()) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Local control message must be a JSON object.");
        }
        handleRequest(parsed as Record<string, unknown>);
      } catch (error) {
        respond({ ok: false, error: error instanceof Error ? error.message : "Invalid control message." });
      }
    });
    socket.on("error", () => undefined);
  });

  if (!CONTROL_SOCKET || !ROOT) throw new Error("Journal Phase A control socket path is unavailable.");
  controlServer.listen(CONTROL_SOCKET, () => {
    if (!CONTROL_SOCKET) return;
    chmodSync(CONTROL_SOCKET, 0o600);
  });

  const domain = process.env.REPLIT_DEV_DOMAIN!;
  console.info(`[journal-phase-a] PUBLIC_HANDOFF ${JSON.stringify({
    status: "ACTIVE",
    origin: `https://${domain}`,
    publicKeyPem: publicPem,
    kid,
    issuer: JOURNAL_DEV_ISSUER,
    audience: EXPECTED_JOURNAL_AUDIENCE,
    expiresAt,
    signerSelfVerified: true,
    database: "disposable loopback PostgreSQL",
    phaseB: "not active",
  })}`);
  console.info(`[journal-phase-a] Local control socket ready; current session deadline is fixed at ${expiresAt}.`);

  await import("../server/index.ts");

  const appDeadline = Date.now() + 30_000;
  while (Date.now() < appDeadline) {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/health");
      if (response.ok) {
        console.info("[journal-phase-a] Journal app health check passed.");
        return;
      }
    } catch {
      // The Express server may still be initializing.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Journal app did not become healthy inside the isolated Phase A supervisor.");
}

process.on("exit", () => {
  if (markerStatus === "active") markerStatus = "stopped";
  updateSessionMarker(markerStatus);
});
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Journal Phase A startup failed.");
  process.exit(1);
});
