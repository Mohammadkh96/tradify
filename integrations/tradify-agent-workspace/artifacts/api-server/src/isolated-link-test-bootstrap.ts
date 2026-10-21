import crypto from "node:crypto";
import { env } from "@workspace/config";
import { pool } from "@workspace/db";
import {
  JOURNAL_AUDIENCE,
  JOURNAL_ISSUER,
  SIGNALS_AUDIENCE,
  SIGNALS_ISSUER,
  linkingConfigurationReady,
  linkingEnabled,
  makeSignalsAssertion,
} from "./product-linking";

function report(name: string, passed: boolean): boolean {
  console.log(`ISOLATED_LINK_CHECK ${name}=${passed ? "PASS" : "FAIL"}`);
  return passed;
}

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
const target = await pool.query(
  "SELECT current_database() AS name, inet_server_addr()::text AS address",
);
const row = target.rows[0];
const privateKey = crypto.createPrivateKey(process.env.SIGNALS_LINKING_PRIVATE_KEY ?? "");
const journalKey = crypto.createPublicKey(process.env.JOURNAL_LINKING_PUBLIC_KEY ?? "");
const checks = {
  test_mode_gate: linkingEnabled(),
  effective_test_deadline_is_valid:
    Boolean(process.env.TRADIFY_LINK_TEST_DEADLINE) &&
    Number.isFinite(Date.parse(process.env.TRADIFY_LINK_TEST_DEADLINE ?? "")) &&
    Date.parse(process.env.TRADIFY_LINK_TEST_DEADLINE ?? "") > Date.now(),
  issuer_pair_matches:
    process.env.SIGNALS_LINKING_ISSUER === SIGNALS_ISSUER &&
    process.env.JOURNAL_LINKING_ISSUER === JOURNAL_ISSUER,
  signals_audience_targets_journal:
    process.env.SIGNALS_LINKING_AUDIENCE === JOURNAL_AUDIENCE,
  journal_audience_targets_signals:
    process.env.JOURNAL_LINKING_AUDIENCE === SIGNALS_AUDIENCE,
  neon_database_overrides_absent:
    !process.env.NEON_DATABASE_URL && !process.env.NEON_DEVELOPMENT_DATABASE_URL,
  environment_cannot_fall_back:
    env.runtimeDatabaseUrl === process.env.DATABASE_URL &&
    url.hostname === "127.0.0.1" &&
    url.pathname === `/${process.env.PGDATABASE}`,
  current_database_is_local_disposable:
    /^tradify_test_[0-9]+_[a-f0-9]{8}$/.test(process.env.PGDATABASE ?? "") &&
    row?.name === process.env.PGDATABASE &&
    row?.address?.split("/")[0] === "127.0.0.1",
  signals_key_is_rsa_2048_or_larger:
    privateKey.asymmetricKeyType === "rsa" &&
    (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048,
  journal_key_is_rsa_2048_or_larger:
    journalKey.asymmetricKeyType === "rsa" &&
    (journalKey.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048,
  both_key_ids_present: Boolean(
    process.env.SIGNALS_LINKING_KEY_ID && process.env.JOURNAL_LINKING_KEY_ID,
  ),
  aggregate_configuration_ready: linkingConfigurationReady(),
};

let allPassed = true;
for (const [name, passed] of Object.entries(checks)) {
  allPassed = report(name, passed) && allPassed;
}
if (!allPassed) {
  await pool.end();
  throw new Error("Isolated linking API readiness failed; refusing to listen.");
}

const assertion = makeSignalsAssertion({ sub: "isolated-signer-self-test" });
const [header, body, signature] = assertion.token.split(".");
const headerValue = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
const bodyValue = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
const signatureValid = crypto.verify(
  "RSA-SHA256",
  Buffer.from(`${header}.${body}`),
  crypto.createPublicKey(privateKey),
  Buffer.from(signature, "base64url"),
);
const signingSelfTestPassed =
  signatureValid &&
  headerValue.kid === process.env.SIGNALS_LINKING_KEY_ID &&
  bodyValue.iss === SIGNALS_ISSUER &&
  bodyValue.aud === JOURNAL_AUDIENCE;
if (!report("active_signer_assertion_verifies", signingSelfTestPassed)) {
  await pool.end();
  throw new Error("Signer self-test failed; refusing to listen.");
}

console.log("ISOLATED_LINK_API_PROCESS_CHECKS=PASS");
await import("./index");
