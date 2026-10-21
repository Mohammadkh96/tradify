import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

export const LOCAL_SESSION_COOKIE = "tradigo_local_session";
export const LOCAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const LOCAL_LOGIN_MAX_ATTEMPTS = 5;
export const LOCAL_LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOCAL_LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
export const LOCAL_LOGIN_MAX_TRACKED_KEYS = 10_000;
const PASSWORD_HASH_VERSION = "scrypt";
const PASSWORD_KEY_LENGTH = 64;

type ScryptOptions = {
  N: number;
  r: number;
  p: number;
};

const SCRYPT_OPTIONS: ScryptOptions = { N: 16_384, r: 8, p: 1 };

function deriveKey(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey as Buffer);
    });
  });
}

function authSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function localLoginAttemptKey(email: string, requestOrigin: string): string {
  return `${normalizeEmail(email)}\u0000${requestOrigin.trim() || "unknown"}`;
}

type LoginAttemptState = {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
};

export type LocalLoginAttemptDecision = {
  allowed: boolean;
  retryAfterMs: number;
};

export type LocalLoginAttemptTracker = {
  check: (key: string, now?: number) => LocalLoginAttemptDecision;
  recordFailure: (key: string, now?: number) => LocalLoginAttemptDecision;
  clear: (key: string) => void;
};

export function createLocalLoginAttemptTracker(options: {
  maxAttempts?: number;
  failureWindowMs?: number;
  lockoutMs?: number;
  maxTrackedKeys?: number;
} = {}): LocalLoginAttemptTracker {
  const maxAttempts = options.maxAttempts ?? LOCAL_LOGIN_MAX_ATTEMPTS;
  const failureWindowMs = options.failureWindowMs ?? LOCAL_LOGIN_FAILURE_WINDOW_MS;
  const lockoutMs = options.lockoutMs ?? LOCAL_LOGIN_LOCKOUT_MS;
  const maxTrackedKeys = options.maxTrackedKeys ?? LOCAL_LOGIN_MAX_TRACKED_KEYS;
  const attempts = new Map<string, LoginAttemptState>();

  const expiresAt = (state: LoginAttemptState): number =>
    Math.max(state.firstFailureAt + failureWindowMs, state.lockedUntil ?? 0);

  const removeExpired = (now: number): void => {
    for (const [key, state] of attempts) {
      if (expiresAt(state) <= now) attempts.delete(key);
    }
  };

  const check = (key: string, now = Date.now()): LocalLoginAttemptDecision => {
    removeExpired(now);
    const state = attempts.get(key);
    if (!state || !state.lockedUntil || state.lockedUntil <= now) {
      return { allowed: true, retryAfterMs: 0 };
    }
    return {
      allowed: false,
      retryAfterMs: Math.max(1, state.lockedUntil - now),
    };
  };

  const recordFailure = (key: string, now = Date.now()): LocalLoginAttemptDecision => {
    const decision = check(key, now);
    if (!decision.allowed) return decision;

    const previous = attempts.get(key);
    const state: LoginAttemptState = previous
      ? { ...previous, failures: previous.failures + 1 }
      : { failures: 1, firstFailureAt: now, lockedUntil: null };
    if (state.failures >= maxAttempts) state.lockedUntil = now + lockoutMs;

    // Reinsert to make the map's insertion order a lightweight LRU for eviction.
    attempts.delete(key);
    attempts.set(key, state);
    while (attempts.size > maxTrackedKeys) {
      const oldestKey = attempts.keys().next().value;
      if (oldestKey === undefined) break;
      attempts.delete(oldestKey);
    }

    return state.lockedUntil && state.lockedUntil > now
      ? { allowed: false, retryAfterMs: state.lockedUntil - now }
      : { allowed: true, retryAfterMs: 0 };
  };

  return {
    check,
    recordFailure,
    clear: (key: string) => {
      attempts.delete(key);
    },
  };
}

export const localLoginAttemptTracker = createLocalLoginAttemptTracker();

export function passwordIsValid(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    PASSWORD_HASH_VERSION,
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt.toString("base64url"),
    (derivedKey as Buffer).toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [version, nValue, rValue, pValue, saltValue, keyValue] = encodedHash.split("$");
  if (version !== PASSWORD_HASH_VERSION || !nValue || !rValue || !pValue || !saltValue || !keyValue) return false;

  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p) || n <= 1 || r <= 0 || p <= 0) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expectedKey = Buffer.from(keyValue, "base64url");
    const actualKey = await deriveKey(password, salt, expectedKey.length, { N: n, r, p });
    return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}

export function createAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function authTokenEncryptionKey(): Buffer | null {
  const secret = authSecret();
  return secret ? createHash("sha256").update(`tradigo-auth-email:${secret}`).digest() : null;
}

export function encryptAuthToken(token: string): string | null {
  const key = authTokenEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptAuthToken(encrypted: string): string | null {
  const key = authTokenEncryptionKey();
  if (!key) return null;
  const [ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export type LocalSession = {
  userId: string;
  expiresAt: number;
  sessionVersion: number;
};

export function signLocalSession(userId: string, sessionVersion: number, now = Date.now()): string | null {
  const secret = authSecret();
  if (!secret) return null;
  const expiresAt = now + LOCAL_SESSION_TTL_MS;
  const payload = `${userId}.${expiresAt}.${sessionVersion}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyLocalSession(raw: string, now = Date.now()): LocalSession | null {
  const secret = authSecret();
  if (!secret) return null;
  const [userId, expiresAtValue, sessionVersionValue, signature] = raw.split(".");
  const expiresAt = Number(expiresAtValue);
  const sessionVersion = Number(sessionVersionValue);
  if (!userId || !expiresAtValue || !sessionVersionValue || !signature
    || !Number.isSafeInteger(expiresAt) || expiresAt <= now
    || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0) return null;

  const payload = `${userId}.${expiresAt}.${sessionVersion}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  return { userId, expiresAt, sessionVersion };
}

export function localCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCAL_SESSION_TTL_MS,
    path: "/",
  };
}