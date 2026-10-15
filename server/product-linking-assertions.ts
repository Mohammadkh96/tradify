import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";

export const LINK_CONTRACT_VERSION = "tradify-account-linking-v1";
export const JOURNAL_INITIATION_CONSENT_VERSION = "tradify-journal-link-initiation-v1";
export const JOURNAL_CONFIRMATION_CONSENT_VERSION = "tradify-journal-link-confirmation-v1";
export const SIGNALS_CONSENT_VERSION = "tradify-signals-link-consent-v1";
export const SIGNALS_DEV_ISSUER = "https://linking-dev.signals.tradifyapp.com";
export const JOURNAL_DEV_ISSUER = "https://linking-dev.journal.tradifyapp.com";
export const JOURNAL_LINK_AUDIENCE = "tradify-journal-link-v1-dev";
export const SIGNALS_LINK_AUDIENCE = "tradify-signals-link-v1-dev";
export const SIGNALS_LINK_SERVICE_SUBJECT = "tradify-signals-link-service";
export const JOURNAL_LINK_SERVICE_SUBJECT = "tradify-journal-link-service";
export const MAX_ASSERTION_LIFETIME_SECONDS = 120;

const SIGNALS_PREVIOUS_KEY_MAX_OVERLAP_DAYS = 7;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JTI = /^[A-Za-z0-9._~-]{16,128}$/;
const ATTEMPT_LABEL = /^(?:JRN|SIG)-[A-Z2-7]{12}$/;
const ALLOWED_REVOCATION_REASONS = new Set([
  "user_unlinked",
  "account_deleted",
  "account_suspended",
  "security_action",
]);

export type RevocationReason =
  | "user_unlinked"
  | "account_deleted"
  | "account_suspended"
  | "security_action";

type SignalsKeyring = {
  issuer: typeof SIGNALS_DEV_ISSUER;
  keys: Map<string, KeyObject>;
};

export type JournalSigningConfig = {
  issuer: typeof JOURNAL_DEV_ISSUER;
  audience: typeof SIGNALS_LINK_AUDIENCE;
  keyId: string;
  privateKey: KeyObject;
  apiBaseUrl: URL;
};

export type VerifiedSignalsAssertion =
  | {
      action: "claim";
      issuer: typeof SIGNALS_DEV_ISSUER;
      audience: typeof JOURNAL_LINK_AUDIENCE;
      keyId: string;
      subject: string;
      jti: string;
      issuedAt: number;
      expiresAt: number;
      consentAt: number;
      consentVersion: typeof SIGNALS_CONSENT_VERSION;
      journalInitiationConsentVersion: typeof JOURNAL_INITIATION_CONSENT_VERSION;
      journalAttemptLabel: string;
      signalsAttemptLabel: string;
      codeSha256: string;
      fingerprint: string;
    }
  | {
      action: "status";
      issuer: typeof SIGNALS_DEV_ISSUER;
      audience: typeof JOURNAL_LINK_AUDIENCE;
      keyId: string;
      subject: string;
      jti: string;
      issuedAt: number;
      expiresAt: number;
      linkId: string;
      fingerprint: string;
    }
  | {
      action: "revoke";
      issuer: typeof SIGNALS_DEV_ISSUER;
      audience: typeof JOURNAL_LINK_AUDIENCE;
      keyId: string;
      subject: typeof SIGNALS_LINK_SERVICE_SUBJECT;
      jti: string;
      issuedAt: number;
      expiresAt: number;
      linkId: string;
      eventId: string;
      reason: RevocationReason;
      payloadHash: string;
      fingerprint: string;
    };

type JsonObject = Record<string, unknown>;

export type RevocationPayload = {
  contractVersion: typeof LINK_CONTRACT_VERSION;
  eventId: string;
  linkId: string;
  reason: RevocationReason;
};

function enabledForIsolatedDevelopment(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.APP_ENV !== "production" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") &&
    process.env.DEV_PRODUCT_LINKING_ENABLED === "true";
}

export function assertDevelopmentSigningKeyNotInProduction(): void {
  const production = process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
  const hasDevelopmentPrivateKey = Boolean(
    process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY?.trim() ||
    process.env.TRADIFY_JOURNAL_PRIVATE_KEY?.trim(),
  );
  if (production && hasDevelopmentPrivateKey) {
    throw new Error("Refusing production startup: a development-only Journal signing key is configured.");
  }
}

function canonicalHttpsIdentity(value: string | undefined, expected: string): value is string {
  if (!value || value !== expected) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.search === "" &&
      parsed.hash === "" &&
      parsed.pathname === "/" &&
      parsed.toString() === `${expected}/`;
  } catch {
    return false;
  }
}

function parseRsaPublicKey(pem: string | undefined): KeyObject | null {
  if (!pem?.trim()) return null;
  try {
    const key = createPublicKey(pem.replace(/\\n/g, "\n").trim());
    if (
      key.asymmetricKeyType !== "rsa" ||
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

export function getSignalsKeyring(): SignalsKeyring | null {
  if (!enabledForIsolatedDevelopment()) return null;
  if (!canonicalHttpsIdentity(process.env.TRADIFY_SIGNALS_ISSUER, SIGNALS_DEV_ISSUER)) return null;

  const primaryKid = process.env.TRADIFY_SIGNALS_KEY_ID?.trim();
  const primaryKey = parseRsaPublicKey(process.env.TRADIFY_SIGNALS_PUBLIC_KEY);
  if (!primaryKid || primaryKid.length > 128 || !primaryKey) return null;

  const keys = new Map<string, KeyObject>([[primaryKid, primaryKey]]);
  const previousKid = process.env.TRADIFY_SIGNALS_PREVIOUS_KEY_ID?.trim();
  const previousPem = process.env.TRADIFY_SIGNALS_PREVIOUS_PUBLIC_KEY;
  if (Boolean(previousKid) !== Boolean(previousPem)) return null;
  if (previousKid && previousPem) {
    const previousKey = parseRsaPublicKey(previousPem);
    if (
      !previousKey ||
      previousKid.length > 128 ||
      previousKid === primaryKid ||
      !validPreviousKeyWindow()
    ) {
      return null;
    }
    keys.set(previousKid, previousKey);
  }
  return { issuer: SIGNALS_DEV_ISSUER, keys };
}

function validPreviousKeyWindow(): boolean {
  const until = process.env.TRADIFY_SIGNALS_PREVIOUS_KEY_EXPIRES_AT;
  if (!until) return false;
  const expiry = Date.parse(until);
  const now = Date.now();
  const maxOverlap = SIGNALS_PREVIOUS_KEY_MAX_OVERLAP_DAYS * 24 * 60 * 60 * 1000;
  return Number.isFinite(expiry) && expiry > now && expiry - now <= maxOverlap;
}

export function getJournalSigningConfig(): JournalSigningConfig | null {
  if (!enabledForIsolatedDevelopment()) return null;
  if (!canonicalHttpsIdentity(process.env.TRADIFY_JOURNAL_ISSUER, JOURNAL_DEV_ISSUER)) return null;
  if (process.env.TRADIFY_JOURNAL_AUDIENCE !== SIGNALS_LINK_AUDIENCE) return null;

  const keyId = process.env.TRADIFY_JOURNAL_KEY_ID?.trim();
  const privatePem = process.env.DEV_TRADIFY_JOURNAL_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const apiBase = process.env.TRADIFY_SIGNALS_API_BASE_URL?.trim();
  if (!keyId || keyId.length > 128 || !privatePem || !apiBase) return null;

  try {
    const privateKey = createPrivateKey(privatePem);
    if (
      privateKey.asymmetricKeyType !== "rsa" ||
      (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) {
      return null;
    }
    const apiBaseUrl = new URL(apiBase);
    if (
      apiBaseUrl.protocol !== "https:" ||
      apiBaseUrl.username ||
      apiBaseUrl.password ||
      apiBaseUrl.pathname !== "/" ||
      apiBaseUrl.search ||
      apiBaseUrl.hash
    ) {
      return null;
    }
    return {
      issuer: JOURNAL_DEV_ISSUER,
      audience: SIGNALS_LINK_AUDIENCE,
      keyId,
      privateKey,
      apiBaseUrl,
    };
  } catch {
    return null;
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalizeRevocationPayload(payload: RevocationPayload): string {
  const ordered = Object.fromEntries(
    Object.entries(payload).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  );
  return JSON.stringify(ordered);
}

export function createAttemptLabel(product: "JRN" | "SIG"): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = randomBytes(12);
  return `${product}-${Array.from(bytes, (byte) => alphabet[byte & 31]).join("")}`;
}

function parseJsonWithoutDuplicateKeys(json: string): unknown {
  let index = 0;

  const skipWhitespace = () => {
    while (/\s/.test(json[index] ?? "")) index += 1;
  };

  const parseString = (): string => {
    const start = index;
    if (json[index] !== '"') throw new Error("Expected JSON string");
    index += 1;
    while (index < json.length) {
      const char = json[index++];
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        return JSON.parse(json.slice(start, index)) as string;
      }
    }
    throw new Error("Unterminated JSON string");
  };

  const parseValue = (): unknown => {
    skipWhitespace();
    const char = json[index];
    if (char === '"') return parseString();
    if (char === "{") {
      index += 1;
      skipWhitespace();
      const object: JsonObject = {};
      const keys = new Set<string>();
      if (json[index] === "}") {
        index += 1;
        return object;
      }
      while (index < json.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new Error("Duplicate JSON key");
        keys.add(key);
        skipWhitespace();
        if (json[index++] !== ":") throw new Error("Expected JSON colon");
        object[key] = parseValue();
        skipWhitespace();
        const delimiter = json[index++];
        if (delimiter === "}") return object;
        if (delimiter !== ",") throw new Error("Expected JSON object delimiter");
      }
      throw new Error("Unterminated JSON object");
    }
    if (char === "[") {
      index += 1;
      skipWhitespace();
      const values: unknown[] = [];
      if (json[index] === "]") {
        index += 1;
        return values;
      }
      while (index < json.length) {
        values.push(parseValue());
        skipWhitespace();
        const delimiter = json[index++];
        if (delimiter === "]") return values;
        if (delimiter !== ",") throw new Error("Expected JSON array delimiter");
      }
      throw new Error("Unterminated JSON array");
    }
    const start = index;
    while (index < json.length && !/[\s,}\]]/.test(json[index])) index += 1;
    if (start === index) throw new Error("Expected JSON value");
    return JSON.parse(json.slice(start, index)) as unknown;
  };

  const value = parseValue();
  skipWhitespace();
  if (index !== json.length) throw new Error("Trailing JSON data");
  return value;
}

function decodeJwtJsonSegment(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("Invalid base64url segment");
  const decoded = Buffer.from(segment, "base64url");
  if (decoded.toString("base64url") !== segment) throw new Error("Non-canonical base64url segment");
  return parseJsonWithoutDuplicateKeys(decoded.toString("utf8"));
}

function hasExactKeys(value: JsonObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isSignalsSubject(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length === 32 && decoded.toString("base64url") === value;
  } catch {
    return false;
  }
}

function validTimeClaims(claims: JsonObject, nowSeconds: number): claims is JsonObject & {
  iat: number;
  exp: number;
  jti: string;
} {
  return Number.isInteger(claims.iat) &&
    Number.isInteger(claims.exp) &&
    (claims.iat as number) >= nowSeconds - MAX_ASSERTION_LIFETIME_SECONDS &&
    (claims.iat as number) <= nowSeconds + 30 &&
    (claims.exp as number) > nowSeconds &&
    (claims.exp as number) > (claims.iat as number) &&
    (claims.exp as number) - (claims.iat as number) <= MAX_ASSERTION_LIFETIME_SECONDS &&
    typeof claims.jti === "string" &&
    JTI.test(claims.jti);
}

export function verifySignalsAssertion(
  token: string | undefined,
  action: "claim",
): Extract<VerifiedSignalsAssertion, { action: "claim" }> | null;
export function verifySignalsAssertion(
  token: string | undefined,
  action: "status",
): Extract<VerifiedSignalsAssertion, { action: "status" }> | null;
export function verifySignalsAssertion(
  token: string | undefined,
  action: "revoke",
): Extract<VerifiedSignalsAssertion, { action: "revoke" }> | null;
export function verifySignalsAssertion(
  token: string | undefined,
  action: VerifiedSignalsAssertion["action"],
): VerifiedSignalsAssertion | null;
export function verifySignalsAssertion(
  token: string | undefined,
  action: VerifiedSignalsAssertion["action"],
): VerifiedSignalsAssertion | null {
  if (!token || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const keyring = getSignalsKeyring();
  if (!keyring) return null;

  try {
    const header = decodeJwtJsonSegment(parts[0]);
    const claims = decodeJwtJsonSegment(parts[1]);
    if (!header || typeof header !== "object" || Array.isArray(header)) return null;
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) return null;
    const jwtHeader = header as JsonObject;
    const jwtClaims = claims as JsonObject;
    const headerKeys = ["alg", "kid", "typ"] as const;
    if (
      !hasExactKeys(jwtHeader, headerKeys) ||
      jwtHeader.alg !== "RS256" ||
      jwtHeader.typ !== "JWT" ||
      typeof jwtHeader.kid !== "string"
    ) {
      return null;
    }
    const publicKey = keyring.keys.get(jwtHeader.kid);
    if (!publicKey) return null;

    const signature = Buffer.from(parts[2], "base64url");
    if (
      !/^[A-Za-z0-9_-]+$/.test(parts[2]) ||
      signature.toString("base64url") !== parts[2] ||
      !verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, signature)
    ) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      jwtClaims.iss !== keyring.issuer ||
      jwtClaims.aud !== JOURNAL_LINK_AUDIENCE ||
      !validTimeClaims(jwtClaims, nowSeconds) ||
      jwtClaims.contract_version !== LINK_CONTRACT_VERSION ||
      jwtClaims.action !== action
    ) {
      return null;
    }

    const common = {
      issuer: SIGNALS_DEV_ISSUER,
      audience: JOURNAL_LINK_AUDIENCE,
      keyId: jwtHeader.kid,
      jti: jwtClaims.jti,
      issuedAt: jwtClaims.iat,
      expiresAt: jwtClaims.exp,
      fingerprint: sha256(token),
    } as const;

    if (action === "claim") {
      const expectedKeys = [
        "action",
        "aud",
        "code_sha256",
        "consent",
        "consent_at",
        "consent_version",
        "contract_version",
        "exp",
        "iat",
        "iss",
        "journal_attempt_label",
        "journal_initiation_consent_version",
        "jti",
        "signals_attempt_label",
        "sub",
      ];
      if (
        !hasExactKeys(jwtClaims, expectedKeys) ||
        !isSignalsSubject(jwtClaims.sub) ||
        jwtClaims.consent !== true ||
        !Number.isInteger(jwtClaims.consent_at) ||
        (jwtClaims.consent_at as number) < nowSeconds - MAX_ASSERTION_LIFETIME_SECONDS ||
        (jwtClaims.consent_at as number) > nowSeconds + 30 ||
        (jwtClaims.consent_at as number) > (jwtClaims.iat as number) + 30 ||
        jwtClaims.consent_version !== SIGNALS_CONSENT_VERSION ||
        jwtClaims.journal_initiation_consent_version !== JOURNAL_INITIATION_CONSENT_VERSION ||
        typeof jwtClaims.journal_attempt_label !== "string" ||
        !/^JRN-[A-Z2-7]{12}$/.test(jwtClaims.journal_attempt_label) ||
        typeof jwtClaims.signals_attempt_label !== "string" ||
        !/^SIG-[A-Z2-7]{12}$/.test(jwtClaims.signals_attempt_label) ||
        typeof jwtClaims.code_sha256 !== "string" ||
        !SHA256_HEX.test(jwtClaims.code_sha256)
      ) {
        return null;
      }
      return {
        ...common,
        action,
        subject: jwtClaims.sub,
        consentAt: jwtClaims.consent_at as number,
        consentVersion: SIGNALS_CONSENT_VERSION,
        journalInitiationConsentVersion: JOURNAL_INITIATION_CONSENT_VERSION,
        journalAttemptLabel: jwtClaims.journal_attempt_label,
        signalsAttemptLabel: jwtClaims.signals_attempt_label,
        codeSha256: jwtClaims.code_sha256,
      };
    }

    if (action === "status") {
      const expectedKeys = [
        "action",
        "aud",
        "contract_version",
        "exp",
        "iat",
        "iss",
        "jti",
        "link_id",
        "sub",
      ];
      if (
        !hasExactKeys(jwtClaims, expectedKeys) ||
        !isSignalsSubject(jwtClaims.sub) ||
        typeof jwtClaims.link_id !== "string" ||
        !UUID.test(jwtClaims.link_id)
      ) {
        return null;
      }
      return {
        ...common,
        action,
        subject: jwtClaims.sub,
        linkId: jwtClaims.link_id,
      };
    }

    const expectedKeys = [
      "action",
      "aud",
      "contract_version",
      "event_id",
      "exp",
      "iat",
      "iss",
      "jti",
      "link_id",
      "payload_sha256",
      "reason",
      "sub",
    ];
    if (
      !hasExactKeys(jwtClaims, expectedKeys) ||
      jwtClaims.sub !== SIGNALS_LINK_SERVICE_SUBJECT ||
      typeof jwtClaims.link_id !== "string" ||
      !UUID.test(jwtClaims.link_id) ||
      typeof jwtClaims.event_id !== "string" ||
      !UUID.test(jwtClaims.event_id) ||
      typeof jwtClaims.reason !== "string" ||
      !ALLOWED_REVOCATION_REASONS.has(jwtClaims.reason) ||
      typeof jwtClaims.payload_sha256 !== "string" ||
      !SHA256_HEX.test(jwtClaims.payload_sha256)
    ) {
      return null;
    }
    return {
      ...common,
      action,
      subject: SIGNALS_LINK_SERVICE_SUBJECT,
      linkId: jwtClaims.link_id,
      eventId: jwtClaims.event_id,
      reason: jwtClaims.reason as RevocationReason,
      payloadHash: jwtClaims.payload_sha256,
    };
  } catch {
    return null;
  }
}

export function signJournalAssertion(
  config: JournalSigningConfig,
  action: "status" | "revoke",
  operationClaims: {
    linkId: string;
    eventId?: string;
    reason?: RevocationReason;
    payloadHash?: string;
    subject?: string;
  },
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: config.keyId,
  };
  const claims: JsonObject = {
    iss: config.issuer,
    aud: config.audience,
    sub: action === "revoke"
      ? JOURNAL_LINK_SERVICE_SUBJECT
      : operationClaims.subject,
    iat: nowSeconds,
    exp: nowSeconds + MAX_ASSERTION_LIFETIME_SECONDS,
    jti: randomBytes(24).toString("base64url"),
    action,
    contract_version: LINK_CONTRACT_VERSION,
    link_id: operationClaims.linkId,
  };
  if (action === "revoke") {
    claims.event_id = operationClaims.eventId;
    claims.reason = operationClaims.reason;
    claims.payload_sha256 = operationClaims.payloadHash;
  }
  if (
    typeof claims.sub !== "string" ||
    !claims.sub ||
    !UUID.test(operationClaims.linkId) ||
    (action === "revoke" && (
      !operationClaims.eventId ||
      !UUID.test(operationClaims.eventId) ||
      !operationClaims.reason ||
      !ALLOWED_REVOCATION_REASONS.has(operationClaims.reason) ||
      !operationClaims.payloadHash ||
      !SHA256_HEX.test(operationClaims.payloadHash)
    ))
  ) {
    throw new Error("Invalid Journal assertion operation.");
  }
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), config.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isAttemptLabel(value: unknown): value is string {
  return typeof value === "string" && ATTEMPT_LABEL.test(value);
}

export function isRevocationReason(value: unknown): value is RevocationReason {
  return typeof value === "string" && ALLOWED_REVOCATION_REASONS.has(value);
}

export function constantTimeHexEqual(left: string, right: string): boolean {
  if (!SHA256_HEX.test(left) || !SHA256_HEX.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
