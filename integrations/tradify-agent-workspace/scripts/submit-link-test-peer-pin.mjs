import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";

const [socketPath, handoffPath, kid, origin, journalExpiresAt, signalsExpiresAt] =
  process.argv.slice(2);
if (!socketPath || !handoffPath || !kid || !origin || !journalExpiresAt || !signalsExpiresAt) {
  throw new Error(
    "Usage: node scripts/submit-link-test-peer-pin.mjs <socket> <handoff-file> <journal-kid> <journal-origin> <journal-expiry> <signals-expiry>",
  );
}

const handoff = fs.readFileSync(handoffPath, "utf8");
if (
  !handoff.includes(kid) ||
  !handoff.includes(origin) ||
  !handoff.includes(journalExpiresAt) ||
  !handoff.includes("https://linking-dev.journal.tradifyapp.com") ||
  !handoff.includes("tradify-signals-link-v1-dev")
) throw new Error("The supplied Journal metadata does not match the handoff file.");
const publicPem = handoff.match(
  /-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/,
)?.[0];
if (!publicPem) throw new Error("The Journal handoff contains no public PEM.");
const publicKey = crypto.createPublicKey(publicPem);
if (
  publicKey.asymmetricKeyType !== "rsa" ||
  (publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
) throw new Error("The Journal public key must be RSA-2048 or stronger.");

const journalExpiryMs = Date.parse(journalExpiresAt);
const signalsExpiryMs = Date.parse(signalsExpiresAt);
if (
  !Number.isFinite(journalExpiryMs) ||
  !Number.isFinite(signalsExpiryMs) ||
  journalExpiryMs <= Date.now() ||
  signalsExpiryMs <= Date.now()
) throw new Error("Both Phase A signer expirations must be valid and still in the future.");
const payload = JSON.stringify({
  phase: "A_READY",
  privateKeyRetained: true,
  publicPem,
  kid,
  origin,
  issuer: "https://linking-dev.journal.tradifyapp.com",
  audience: "tradify-signals-link-v1-dev",
  journalExpiresAt: new Date(journalExpiryMs).toISOString(),
});

await new Promise((resolve, reject) => {
  const socket = net.createConnection(socketPath);
  let response = "";
  socket.setEncoding("utf8");
  socket.once("error", reject);
  socket.on("data", (chunk) => { response += chunk; });
  socket.once("end", () => {
    if (response.trim() !== "PIN_RECEIVED") {
      reject(new Error("Supervisor did not acknowledge the Journal pin."));
    } else {
      resolve();
    }
  });
  socket.once("connect", () => socket.write(`${payload}\n`));
});

console.log("PHASE_B_PEER_PIN_ACCEPTED=PASS");
