import { createHash, createHmac, createPublicKey, createVerify, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { handleIdentityProviderWebhook } from "./identityProviderWebhook";
import { ensureAdminAuditSchema, writeAdminAudit } from "./adminAudit";
import {
  availableSlots,
  availabilityDto,
  checkScheduledSlot,
  containsProhibitedTradingActivity,
  ensureSchedulingSchema,
  evaluateCoachingPolicy,
  getAvailability,
  recordMarketplaceEvent,
  recordPolicyDecision,
  type AvailabilityException,
  type AvailabilityRule,
} from "../lib/tradigoScheduling";
import {
  LOCAL_SESSION_COOKIE,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  LOCAL_LOGIN_MAX_ATTEMPTS,
  LOCAL_LOGIN_LOCKOUT_MS,
  LOCAL_LOGIN_FAILURE_WINDOW_MS,
  createAuthToken,
  encryptAuthToken,
  hashPassword,
  hashAuthToken,
  localCookieOptions,
  localLoginAttemptKey,
  normalizeEmail,
  passwordIsValid,
  signLocalSession,
  verifyLocalSession,
  verifyPassword,
} from "../lib/localAuth";
import { authEmailDeliveryConfigured } from "../lib/emailDelivery";

const router: IRouter = Router();
const MATCH_TOPIC_DIMENSIONS = new Set([
  "GENERAL",
  "MARKET_STRUCTURE",
  "RISK_MANAGEMENT",
  "TRADE_REVIEW",
  "PSYCHOLOGY",
]);

type DemoActor = {
  id: string;
  role: "TRADER" | "COACH";
  displayName: string;
  email?: string;
  status?: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
};

const demoCoaches = [
  {
    id: "demo-coach-maya",
    displayName: "Maya Chen",
    avatarUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=256&q=80",
    headline: "Structure-first price action coach",
    bio: "I help traders replace impulsive entries with a repeatable process for reading structure, planning risk, and reviewing execution.",
    markets: ["FOREX", "INDICES"],
    specialties: ["MARKET_STRUCTURE", "ENTRY_TIMING", "RISK_MANAGEMENT"],
    languages: ["English", "Mandarin"],
    yearsOfExperience: 8,
    hourlyRateCents: 14500,
    instantRatePerMinuteCents: 242,
    currency: "USD",
    verificationStatus: "FULLY_VERIFIED",
    ratingAverageTenths: 49,
    ratingCount: 128,
  },
  {
    id: "demo-coach-omar",
    displayName: "Omar Haddad",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=256&q=80",
    headline: "Risk management for serious traders",
    bio: "Build a risk framework that protects your account and gives your best setups room to work.",
    markets: ["CRYPTO", "EQUITIES"],
    specialties: ["RISK_MANAGEMENT", "TRADE_REVIEW", "PSYCHOLOGY"],
    languages: ["English", "Arabic"],
    yearsOfExperience: 11,
    hourlyRateCents: 12000,
    instantRatePerMinuteCents: 200,
    currency: "USD",
    verificationStatus: "FULLY_VERIFIED",
    ratingAverageTenths: 48,
    ratingCount: 94,
  },
] as const;

const demoActors: Record<DemoActor["role"], DemoActor> = {
  TRADER: { id: "demo-trader-preview", role: "TRADER", displayName: "Demo Trader" },
  COACH: { id: "demo-coach-maya", role: "COACH", displayName: "Maya Chen" },
};

const DEMO_SESSION_COOKIE = "tradigo_preview_session";
const DEMO_SESSION_TTL_MS = 15 * 60 * 1000;

function demoModeEnabled(): boolean {
  // Replit serves artifact previews through the production runtime, so tying
  // the signed preview accounts to NODE_ENV would make /preview unusable.
  // These are fixed demo identities and every token is still HMAC-signed.
  return Boolean(process.env.SESSION_SECRET);
}

function signDemoSession(actor: DemoActor, expiresAt: number): string {
  const payload = `${actor.id}.${actor.role}.${expiresAt}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readCookie(req: Request, name: string): string | null {
  const value = req.header("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

function actorFromRequest(req: Request): DemoActor | null {
  if (!demoModeEnabled()) return null;
  // A cookie is shared by every tab. The optional tab token lets the preview
  // run trader and coach journeys side by side without sharing identities.
  const raw = req.header("x-tradigo-preview-session")
    || readCookie(req, DEMO_SESSION_COOKIE);
  if (!raw) return null;
  const [id, role, expiresAtValue, signature] = raw.split(".");
  if (!id || !role || !expiresAtValue || !signature || !["TRADER", "COACH"].includes(role)) return null;
  const actor = demoActors[role as DemoActor["role"]];
  const expiresAt = Number(expiresAtValue);
  if (!actor || actor.id !== id || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const expected = signDemoSession(actor, expiresAt).split(".").at(-1)!;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return actor;
}

async function requireDemoActor(req: Request): Promise<ApplicationIdentity | null> {
  return getAuthenticatedActor(req);
}

type ModeratorIdentity = {
  id: string;
  role: "ADMIN" | "MODERATOR";
  email?: string;
  status?: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
};

export type ApplicationIdentity = {
  id: string;
  role: "TRADER" | "COACH" | "ADMIN" | "MODERATOR";
  email?: string;
  displayName?: string;
  status?: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
  kind?: "PREVIEW" | "FIREBASE" | "LOCAL" | "SIGNED_MODERATOR";
  countryCode?: string;
};

type FirebaseKeySet = Record<string, string>;
let firebaseKeys: { expiresAt: number; keys: FirebaseKeySet } | null = null;
let identitySchemaReady: Promise<void> | null = null;

function canonicalUserId(firebaseUid: string): string {
  return `usr_${createHash("sha256").update(firebaseUid).digest("hex").slice(0, 32)}`;
}

async function localIdentityFromRequest(req: Request): Promise<ApplicationIdentity | null> {
  const raw = readCookie(req, LOCAL_SESSION_COOKIE);
  if (!raw) return null;
  const session = verifyLocalSession(raw);
  if (!session) return null;

  await ensureIdentitySchema();
  const result = await pool.query(
    `SELECT id, email, display_name, role, status, country_code, local_session_version
     FROM tradigo_users WHERE id=$1 AND firebase_uid LIKE 'local:%'`,
    [session.userId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row || row.status !== "ACTIVE" || Number(row.local_session_version ?? 0) !== session.sessionVersion) return null;

  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role as ApplicationIdentity["role"],
    status: row.status as ApplicationIdentity["status"],
    countryCode: String(row.country_code ?? "US"),
    kind: "LOCAL",
  };
}

function claimedFirebaseRole(claims: Record<string, any>): ApplicationIdentity["role"] {
  const claimedRole = claims.role ?? claims["https://tradigo.app/role"] ?? claims.custom_claims?.role;
  return ["TRADER", "COACH", "ADMIN", "MODERATOR"].includes(claimedRole)
    ? claimedRole
    : "TRADER";
}

export function ensureIdentitySchema(): Promise<void> {
  if (!identitySchemaReady) {
    identitySchemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS tradigo_users (
        id text PRIMARY KEY,
        firebase_uid text NOT NULL,
        email text NOT NULL,
        display_name text NOT NULL,
        avatar_url text,
        role text NOT NULL DEFAULT 'TRADER',
        status text NOT NULL DEFAULT 'ACTIVE',
        country_code text NOT NULL DEFAULT 'US',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        email_normalized text,
        password_hash text,
        local_session_version integer NOT NULL DEFAULT 0,
        consent_accepted_at timestamptz,
        consent_version text,
        email_verified_at timestamptz
      );
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS email_normalized text;
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS local_session_version integer NOT NULL DEFAULT 0;
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz;
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS consent_version text;
      ALTER TABLE tradigo_users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
      UPDATE tradigo_users SET email_normalized = LOWER(TRIM(email)) WHERE email_normalized IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_users_firebase_uid_idx ON tradigo_users(firebase_uid);
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_users_email_normalized_idx ON tradigo_users(email_normalized);
      CREATE INDEX IF NOT EXISTS tradigo_users_role_status_idx ON tradigo_users(role, status);
      CREATE TABLE IF NOT EXISTS tradigo_local_login_throttles (
        key_hash text PRIMARY KEY,
        attempt_count integer NOT NULL DEFAULT 0,
        window_started_at timestamptz NOT NULL,
        locked_until timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_local_login_throttles_updated_idx
        ON tradigo_local_login_throttles(updated_at);
      CREATE TABLE IF NOT EXISTS tradigo_auth_tokens (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        token_hash text NOT NULL,
        token_kind text NOT NULL,
        expires_at timestamptz NOT NULL,
        activated_at timestamptz,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE tradigo_auth_tokens ADD COLUMN IF NOT EXISTS activated_at timestamptz;
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_auth_tokens_hash_idx ON tradigo_auth_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS tradigo_auth_tokens_user_kind_idx ON tradigo_auth_tokens(user_id, token_kind, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_auth_tokens_one_active_idx
        ON tradigo_auth_tokens(user_id, token_kind)
        WHERE activated_at IS NOT NULL AND consumed_at IS NULL;
      CREATE TABLE IF NOT EXISTS tradigo_auth_email_outbox (
        id text PRIMARY KEY,
        token_id text NOT NULL,
        user_id text NOT NULL,
        email_kind text NOT NULL,
        recipient text NOT NULL,
        recipient_name text NOT NULL,
        encrypted_token text NOT NULL,
        action_base_url text NOT NULL,
        expires_in_hours integer NOT NULL,
        attempt_count integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_auth_email_outbox_pending_idx
        ON tradigo_auth_email_outbox(next_attempt_at, created_at)
        WHERE sent_at IS NULL;
      CREATE TABLE IF NOT EXISTS tradigo_trader_profiles (
        user_id text PRIMARY KEY,
        experience_level text NOT NULL DEFAULT 'BEGINNER',
        preferred_markets text[] NOT NULL DEFAULT '{}',
        instruments text[] NOT NULL DEFAULT '{}',
        trading_styles text[] NOT NULL DEFAULT '{}',
        methodologies text[] NOT NULL DEFAULT '{}',
        timezone text,
        onboarding_current_step integer NOT NULL DEFAULT 1,
        onboarding_completed_at timestamptz,
        total_sessions_completed integer NOT NULL DEFAULT 0,
        total_spent_cents integer NOT NULL DEFAULT 0,
        blocked_coach_ids text[] NOT NULL DEFAULT '{}',
        preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS tradigo_favorites (
        trader_id text NOT NULL,
        coach_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (trader_id, coach_id)
      );
      CREATE INDEX IF NOT EXISTS tradigo_favorites_trader_idx ON tradigo_favorites(trader_id, created_at);
      CREATE TABLE IF NOT EXISTS tradigo_notification_states (
        user_id text NOT NULL,
        event_id integer NOT NULL,
        read_at timestamptz,
        archived_at timestamptz,
        PRIMARY KEY (user_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS tradigo_notification_states_user_read_idx ON tradigo_notification_states(user_id, read_at);
      CREATE TABLE IF NOT EXISTS tradigo_application_notification_states (
        user_id text NOT NULL,
        clarification_id text NOT NULL,
        read_at timestamptz,
        archived_at timestamptz,
        PRIMARY KEY (user_id, clarification_id)
      );
      CREATE INDEX IF NOT EXISTS tradigo_application_notification_states_user_read_idx
        ON tradigo_application_notification_states(user_id, read_at);
      ALTER TABLE tradigo_session_events ADD COLUMN IF NOT EXISTS recipient_id text;
    `).then(() => undefined);
  }
  return identitySchemaReady;
}

let conductReportsSchemaReady: Promise<void> | null = null;

export function ensureConductReportsSchema(): Promise<void> {
  if (!conductReportsSchemaReady) {
    conductReportsSchemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS tradigo_conduct_reports (
        id text PRIMARY KEY,
        reporter_id text NOT NULL,
        subject_user_id text NOT NULL,
        session_id text,
        reason text NOT NULL,
        details text NOT NULL DEFAULT '',
        evidence_reference text,
        idempotency_key text NOT NULL,
        status text NOT NULL DEFAULT 'OPEN',
        resolved_by text,
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE tradigo_conduct_reports ADD COLUMN IF NOT EXISTS evidence_reference text;
      ALTER TABLE tradigo_conduct_reports ADD COLUMN IF NOT EXISTS idempotency_key text;
      UPDATE tradigo_conduct_reports SET idempotency_key = id WHERE idempotency_key IS NULL;
      ALTER TABLE tradigo_conduct_reports ALTER COLUMN idempotency_key SET NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_conduct_reports_idempotency_key_idx
        ON tradigo_conduct_reports(idempotency_key);
      CREATE INDEX IF NOT EXISTS tradigo_conduct_reports_queue_idx
        ON tradigo_conduct_reports(status, created_at DESC);
    `).then(() => undefined);
  }
  return conductReportsSchemaReady;
}

function decodeJwtPart(value: string): Record<string, any> | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, any>;
  } catch {
    return null;
  }
}

function moderatorFromSignedToken(token: string): ModeratorIdentity | null {
  if (!process.env.SESSION_SECRET) return null;
  const [id, role, expiresAtValue, signature] = token.split(".");
  const expiresAt = Number(expiresAtValue);
  if (!id || id.startsWith("demo-") || !["ADMIN", "MODERATOR"].includes(role) || !Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return null;
  const payload = `${id}.${role}.${expiresAt}`;
  const expected = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return { id, role: role as ModeratorIdentity["role"] };
}

async function getFirebaseKeys(): Promise<FirebaseKeySet> {
  if (firebaseKeys && firebaseKeys.expiresAt > Date.now()) return firebaseKeys.keys;
  const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error(`Firebase signing keys request failed with status ${response.status}.`);
  const keys = await response.json() as FirebaseKeySet;
  const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/i)?.[1] ?? 3600);
  firebaseKeys = { keys, expiresAt: Date.now() + Math.max(60, maxAge) * 1000 };
  return keys;
}

async function moderatorFromFirebaseToken(token: string): Promise<ModeratorIdentity | null> {
  const identity = await firebaseIdentityFromToken(token);
  if (!identity || (identity.role !== "ADMIN" && identity.role !== "MODERATOR")) return null;
  return { id: identity.id, role: identity.role, email: identity.email, status: identity.status };
}

async function firebaseIdentityFromToken(token: string): Promise<ApplicationIdentity | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId || claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
  const keys = await getFirebaseKeys();
  const certificate = keys[header.kid];
  if (!certificate) return null;
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(createPublicKey(certificate), Buffer.from(parts[2], "base64url"))) return null;

  await ensureIdentitySchema();
  const firebaseUid = claims.sub;
  const id = canonicalUserId(firebaseUid);
  const requestedRole = claimedFirebaseRole(claims);
  const initialRole = requestedRole === "ADMIN" || requestedRole === "MODERATOR" ? requestedRole : "TRADER";
  const email = typeof claims.email === "string" && claims.email.trim() ? claims.email.trim().slice(0, 320) : `${id}@users.tradigo.app`;
  const displayName = typeof claims.name === "string" && claims.name.trim()
    ? claims.name.trim().slice(0, 160)
    : email.split("@")[0].slice(0, 160);
  const result = await pool.query(
    `INSERT INTO tradigo_users (id, firebase_uid, email, email_normalized, display_name, role)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (firebase_uid) DO UPDATE
       SET email=EXCLUDED.email, email_normalized=EXCLUDED.email_normalized, display_name=EXCLUDED.display_name, updated_at=NOW()
     RETURNING id, email, display_name, avatar_url, role, status, country_code, created_at, updated_at`,
    [id, firebaseUid, email, normalizeEmail(email), displayName, initialRole],
  );
  const row = result.rows[0] as Record<string, any> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    role: row.role,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    countryCode: row.country_code,
    kind: "FIREBASE",
  };
}

export async function getModeratorIdentity(req: Request): Promise<ModeratorIdentity | null> {
  const authorization = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authorization) return null;
  const signedIdentity = moderatorFromSignedToken(authorization);
  if (signedIdentity) return signedIdentity;
  try {
    const firebaseIdentity = await moderatorFromFirebaseToken(authorization);
    if (firebaseIdentity && (firebaseIdentity.role === "ADMIN" || firebaseIdentity.role === "MODERATOR") && firebaseIdentity.status === "ACTIVE") {
      return { id: firebaseIdentity.id, role: firebaseIdentity.role, email: firebaseIdentity.email };
    }
  } catch {
    return null;
  }
  return null;
}

export async function getApplicationIdentity(req: Request): Promise<ApplicationIdentity | null> {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const signedModerator = moderatorFromSignedToken(token);
    if (signedModerator) return { ...signedModerator, kind: "SIGNED_MODERATOR", status: "ACTIVE" };
    try {
      return await firebaseIdentityFromToken(token);
    } catch {
      return null;
    }
  }
  const demoActor = actorFromRequest(req);
  if (demoActor) {
    return { ...demoActor, email: demoActor.email ?? `${demoActor.role.toLowerCase()}@demo.tradigo.app`, status: "ACTIVE", kind: "PREVIEW" };
  }
  return localIdentityFromRequest(req);
}

export async function getAuthenticatedActor(req: Request): Promise<ApplicationIdentity | null> {
  const identity = await getApplicationIdentity(req);
  if (!identity || identity.status !== "ACTIVE") return null;
  return identity;
}

function isModerator(req: Request): boolean {
  const token = req.header("x-tradigo-admin-key");
  return Boolean(process.env.TRADIGO_ADMIN_KEY && token && token.length === process.env.TRADIGO_ADMIN_KEY.length && timingSafeEqual(Buffer.from(token), Buffer.from(process.env.TRADIGO_ADMIN_KEY)));
}

async function requireModerator(req: Request): Promise<ModeratorIdentity | null> {
  const identity = await getModeratorIdentity(req);
  if (identity) return identity;
  return isModerator(req) ? { id: "admin-key", role: "ADMIN" } : null;
}

function toCoachDto(row: Record<string, unknown>) {
  const approved = row.approved === true || row.approved === "true";
  const identityVerified = ["IDENTITY_VERIFIED", "FULLY_VERIFIED"].includes(String(row.verification_status));
  const hasReviews = Number(row.rating_count ?? 0) > 0;
  const hasReliability = Number(row.reliability_sample_count ?? 0) > 0;
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    bio: row.bio,
    markets: row.markets,
    supportedInstruments: row.markets,
    specialties: row.specialties,
    languages: row.languages,
    yearsOfExperience: row.years_of_experience,
    hourlyRateCents: row.hourly_rate_cents,
    instantRatePerMinuteCents: row.instant_rate_per_minute_cents,
    currency: row.currency,
    verificationStatus: row.verification_status,
    ratingAverage: Number(row.rating_average_tenths) / 10,
    ratingCount: row.rating_count,
    availability: row.availability,
    approved,
    completedSessionCount: Number(row.completed_session_count ?? 0),
    sessionReliabilityPercent: row.session_reliability_percent === null || row.session_reliability_percent === undefined
      ? null
      : Number(row.session_reliability_percent),
    averageResponseMinutes: row.average_response_minutes === null || row.average_response_minutes === undefined
      ? null
      : Number(row.average_response_minutes),
    responseSampleCount: Number(row.response_sample_count ?? 0),
    reliabilitySampleCount: Number(row.reliability_sample_count ?? 0),
    teachingMethod: row.teaching_method,
    coachingBoundaries: row.coaching_boundaries,
    profileChangeStatus: row.profile_change_status ?? "CURRENT",
    proof: {
      approval: {
        status: approved ? "CURRENT" : "NOT_APPROVED",
        label: "Tradigo marketplace approval",
        source: String(row.approval_source ?? "TRADIGO moderation"),
        scope: "Profile, teaching scope, assessments, and education-only boundaries",
        asOf: row.approved_at ?? null,
      },
      identity: {
        status: identityVerified ? "CURRENT" : "NOT_VERIFIED",
        label: "Provider identity verification",
        source: String(row.identity_verification_source ?? "Payout provider"),
        scope: "Identity verification for the provider relationship; not a teaching credential",
        asOf: row.identity_verified_at ?? null,
      },
      teachingScope: {
        status: "CURRENT",
        label: "Teaching scope",
        source: "Coach application",
        scope: "Listed markets, specialties, experience, and stated education-only boundaries",
        asOf: row.approved_at ?? null,
      },
      serviceRecord: {
        status: hasReviews || hasReliability ? "LIMITED_OR_ESTABLISHED" : "NEW",
        label: "Service record",
        source: "Completed Tradigo sessions",
        scope: "Learner feedback and delivery metrics; not investment performance",
        sampleSize: Math.max(Number(row.rating_count ?? 0), Number(row.reliability_sample_count ?? 0)),
        asOf: hasReviews || hasReliability ? row.updated_at ?? null : null,
      },
    },
    isFavorited: row.is_favorited === true || row.is_favorited === "true",
  };
}

function scoreCoachForMatch(
  row: Record<string, any>,
  input: { instrumentClass: string; topic: string; language: string; maxRateCents: number; traderId: string },
) {
  const markets = Array.isArray(row.markets) ? row.markets.map((value: unknown) => String(value).toUpperCase()) : [];
  const specialties = Array.isArray(row.specialties) ? row.specialties.map((value: unknown) => String(value).toUpperCase()) : [];
  const languages = Array.isArray(row.languages) ? row.languages.map((value: unknown) => String(value).toLowerCase()) : [];
  const instrument = input.instrumentClass.toUpperCase();
  const topic = input.topic.toUpperCase();
  const language = input.language.toLowerCase();
  const reasons: string[] = [];
  const instrumentFit = instrument === "GENERAL" || markets.includes(instrument) ? 25 : 0;
  const specialtyFit = !topic || specialties.includes(topic) ? 20 : 0;
  const languageFit = !language || languages.includes(language) ? 15 : 0;
  const rating = Number(row.rating_average_tenths ?? 0) / 10;
  const quality = Math.min(15, Math.round((rating / 5) * 10) + Math.min(5, Math.round(Number(row.years_of_experience ?? 0) / 2)));
  const availability = String(row.availability).toUpperCase() === "AVAILABLE" ? 10 : 0;
  const rate = Number(row.instant_rate_per_minute_cents ?? 0);
  const priceFit = input.maxRateCents <= 0 ? 3 : rate <= input.maxRateCents ? 5 : 0;
  const responseMinutes = Number(row.average_response_minutes ?? 0);
  const responseReliability = Number(row.response_sample_count ?? 0) === 0
    ? 3
    : responseMinutes <= 5 ? 5 : responseMinutes <= 15 ? 4 : responseMinutes <= 30 ? 3 : 2;
  const historicalCompatibility = row.has_repeat_relationship === true ? 5 : 0;
  const reasonCodes = [
    instrumentFit ? "INSTRUMENT_FIT" : null,
    specialtyFit && topic ? "TOPIC_FIT" : null,
    languageFit && language ? "LANGUAGE_FIT" : null,
    availability ? "AVAILABILITY_FIT" : null,
    responseReliability >= 3 ? "RELIABILITY_FIT" : null,
    priceFit === 5 ? "PRICE_FIT" : null,
    historicalCompatibility ? "REPEAT_LEARNING_FIT" : null,
    quality >= 12 ? "LEARNER_FEEDBACK_FIT" : null,
  ].filter((value): value is string => Boolean(value));

  if (instrumentFit) reasons.push(`supports ${instrument === "GENERAL" ? "your market" : instrument}`);
  if (specialtyFit && topic) reasons.push("matches your learning focus");
  if (languageFit && language) reasons.push(`speaks ${input.language}`);
  if (quality >= 12) reasons.push("strong learner feedback");
  if (historicalCompatibility) reasons.push("you have worked together before");
  if (priceFit === 5) reasons.push("fits your price limit");

  return {
    scoreBreakdown: {
      instrumentFit,
      specialtyFit,
      languageFit,
      coachQuality: quality,
      availability,
      priceFit,
      responseReliability,
      historicalCompatibility,
      totalScore: instrumentFit + specialtyFit + languageFit + quality + availability + priceFit + responseReliability + historicalCompatibility,
    },
    matchReasons: reasons.slice(0, 3),
    reasonCodes,
    isEligible: instrumentFit > 0 && specialtyFit > 0 && languageFit > 0 && priceFit > 0,
    ineligibilityReasons: [
      instrumentFit ? "" : "This coach does not list that market.",
      specialtyFit ? "" : "This coach does not list that learning focus.",
      languageFit ? "" : "This coach does not list that language.",
      priceFit ? "" : "This coach is above your price limit.",
    ].filter(Boolean),
  };
}

function matchQualityDimensions(input: {
  mode: string;
  instrumentClass?: string;
  topic?: string;
  language?: string;
  durationMinutes?: number;
  experienceLevel?: string;
  timezoneBucket?: string;
}) {
  const normalizedTopic = String(input.topic || "GENERAL").trim().toUpperCase();
  return {
    mode: input.mode,
    instrumentClass: String(input.instrumentClass || "GENERAL").toUpperCase(),
    topic: MATCH_TOPIC_DIMENSIONS.has(normalizedTopic) ? normalizedTopic : "OTHER",
    language: String(input.language || "UNKNOWN").trim().toLowerCase().slice(0, 40),
    durationBucket: input.durationMinutes && input.durationMinutes <= 15 ? "SHORT"
      : input.durationMinutes && input.durationMinutes <= 30 ? "STANDARD" : "EXTENDED",
    ...(input.experienceLevel ? { experienceLevel: String(input.experienceLevel).toUpperCase() } : {}),
    ...(input.timezoneBucket ? { timezoneBucket: input.timezoneBucket } : {}),
  };
}

async function expireCoachNowClaim(traderId: string, matchGroupId: string): Promise<boolean> {
  const client = await pool.connect();
  let expiredIds: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${matchGroupId}`]);
    const result = await client.query(
      `UPDATE tradigo_sessions
       SET status='CANCELLED', payment_status='CANCELLED',
           cancellation_reason=$3,
           cancelled_at=NOW(), cancelled_by='system:coach-now-claim-expiry', updated_at=NOW()
       WHERE trader_id=$1 AND match_group_id=$2 AND status='COACH_CLAIMED'
         AND coach_claim_expires_at IS NOT NULL AND coach_claim_expires_at <= NOW()
       RETURNING id`,
       [traderId, matchGroupId, COACH_CLAIM_EXPIRY_REASON],
    );
    expiredIds = result.rows.map((row) => String(row.id));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  for (const sessionId of expiredIds) {
    await appendEvent(sessionId, "system:coach-now-claim-expiry", "COACH_CLAIM_EXPIRED", { matchGroupId, failureClass: "EXPIRY" });
  }
  return expiredIds.length > 0;
}

async function matchGroupView(traderId: string, matchGroupId: string): Promise<Record<string, unknown>> {
  const claimExpired = await expireCoachNowClaim(traderId, matchGroupId);
  const result = await pool.query(
    `SELECT s.*, c.id AS coach_profile_id, c.display_name AS coach_display_name,
            c.avatar_url AS coach_avatar_url, c.headline AS coach_headline, c.bio AS coach_bio,
            c.markets AS coach_markets, c.specialties AS coach_specialties,
            c.languages AS coach_languages, c.years_of_experience AS coach_years_of_experience,
            c.hourly_rate_cents AS coach_hourly_rate_cents,
            c.instant_rate_per_minute_cents AS coach_instant_rate_per_minute_cents,
            c.currency AS coach_currency, c.verification_status AS coach_verification_status,
            c.rating_average_tenths AS coach_rating_average_tenths, c.rating_count AS coach_rating_count,
             c.availability AS coach_availability, c.approved AS coach_approved,
             COALESCE(match_quality.details, '{}'::jsonb) AS match_quality_details
     FROM tradigo_sessions s
     JOIN tradigo_coaches c ON c.id=s.coach_id
      LEFT JOIN LATERAL (
        SELECT details
        FROM tradigo_marketplace_events
        WHERE session_id=s.id AND event_type='MATCH_CONTACTED'
        ORDER BY occurred_at ASC
        LIMIT 1
      ) match_quality ON true
     WHERE s.trader_id=$1 AND s.match_group_id=$2
     ORDER BY s.created_at ASC`,
    [traderId, matchGroupId],
  );
  const items = result.rows.map((row) => ({
    coachId: row.coach_id,
    sessionId: row.id,
    state: row.status === "REQUESTED" ? "INVITED" : row.status === "COACH_CLAIMED" ? "CLAIMED" : row.status === "CANCELLED" ? "CLOSED" : "ACCEPTED",
    reasonCodes: Array.isArray(row.match_quality_details?.reasonCodes) ? row.match_quality_details.reasonCodes : [],
    session: toSessionDto(row),
    coach: toCoachDto({
      id: row.coach_profile_id,
      display_name: row.coach_display_name,
      avatar_url: row.coach_avatar_url,
      headline: row.coach_headline,
      bio: row.coach_bio,
      markets: row.coach_markets,
      specialties: row.coach_specialties,
      languages: row.coach_languages,
      years_of_experience: row.coach_years_of_experience,
      hourly_rate_cents: row.coach_hourly_rate_cents,
      instant_rate_per_minute_cents: row.coach_instant_rate_per_minute_cents,
      currency: row.coach_currency,
      verification_status: row.coach_verification_status,
      rating_average_tenths: row.coach_rating_average_tenths,
      rating_count: row.coach_rating_count,
      availability: row.coach_availability,
      approved: row.coach_approved,
    }),
  }));
  const claimed = items.find((item) => item.state === "CLAIMED");
  const accepted = items.find((item) => item.state === "ACCEPTED");
  const invited = items.some((item) => item.state === "INVITED");
  const rematchStats = await pool.query(
    `SELECT COUNT(*)::int AS attempts
     FROM tradigo_sessions
     WHERE trader_id=$1 AND match_group_id=$2 AND status='CANCELLED' AND cancellation_reason=$3`,
    [traderId, matchGroupId, COACH_CLAIM_EXPIRY_REASON],
  );
  const rematchAttempts = Number(rematchStats.rows[0]?.attempts ?? 0);
  const state = accepted ? "PAYMENT_READY" : claimed ? "COACH_CLAIMED" : invited ? "SEARCHING" : "NO_LIVE_MATCH";
  return {
    matchGroupId,
    state,
    items,
    acceptedSessionId: accepted?.sessionId ?? null,
    claimedSessionId: claimed?.sessionId ?? null,
    claimExpiresAt: claimed?.session?.coachClaimExpiresAt ?? null,
    claimExpired,
    rematchAttempts,
    maxRematchAttempts: COACH_NOW_MAX_REMATCH_ATTEMPTS,
    rematchAvailable: state === "NO_LIVE_MATCH" && rematchAttempts < COACH_NOW_MAX_REMATCH_ATTEMPTS,
    ...(state === "NO_LIVE_MATCH" ? {
      fallback: {
        nextAction: "BOOK_SCHEDULED",
        message: rematchAttempts >= COACH_NOW_MAX_REMATCH_ATTEMPTS
          ? "We could not connect you with a live coach after the maximum number of attempts. You can book the next available scheduled session or request an availability alert."
          : "That live coach reservation ended. We can make another bounded search for an eligible coach, or you can book a scheduled session instead.",
      },
    } : {}),
  };
}

type CoachNowRematchResult = {
  status: "REMATCHED" | "TERMINAL" | "NOOP" | "NOT_EXPIRED" | "NOT_FOUND";
  expired: boolean;
};

async function rematchCoachNowClaim(traderId: string, matchGroupId: string): Promise<CoachNowRematchResult> {
  const client = await pool.connect();
  let expiredSessionId: string | null = null;
  const createdSessionIds: string[] = [];
  let status: CoachNowRematchResult["status"] = "NOT_FOUND";
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${matchGroupId}`]);
    const groupResult = await client.query(
      "SELECT * FROM tradigo_sessions WHERE trader_id=$1 AND match_group_id=$2 ORDER BY created_at ASC FOR UPDATE",
      [traderId, matchGroupId],
    );
    const sessions = groupResult.rows as Record<string, any>[];
    if (!sessions.length) {
      await client.query("ROLLBACK");
      return { status: "NOT_FOUND", expired: false };
    }

    const hasActiveSession = sessions.some((session) => {
      const sessionStatus = String(session.status);
      if (sessionStatus === "COACH_CLAIMED") {
        return !session.coach_claim_expires_at || new Date(String(session.coach_claim_expires_at)).getTime() > Date.now();
      }
      return ["REQUESTED", "PAYMENT_READY", "ROOM_READY", "ACTIVE"].includes(sessionStatus);
    });
    if (hasActiveSession) {
      await client.query("COMMIT");
      return { status: "NOOP", expired: false };
    }

    const claimed = sessions.find((session) => String(session.status) === "COACH_CLAIMED");
    if (claimed?.coach_claim_expires_at && new Date(String(claimed.coach_claim_expires_at)).getTime() <= Date.now()) {
      const expired = await client.query(
        `UPDATE tradigo_sessions
         SET status='CANCELLED', payment_status='CANCELLED',
             cancellation_reason=$3,
             cancelled_at=NOW(), cancelled_by='system:coach-now-claim-expiry', updated_at=NOW()
         WHERE id=$1 AND trader_id=$2 AND status='COACH_CLAIMED'
           AND coach_claim_expires_at IS NOT NULL AND coach_claim_expires_at <= NOW()
         RETURNING id`,
        [claimed.id, traderId, COACH_CLAIM_EXPIRY_REASON],
      );
      if (expired.rowCount) expiredSessionId = String(expired.rows[0].id);
    }

    const attemptsResult = await client.query(
      `SELECT COUNT(*)::int AS attempts
       FROM tradigo_sessions
       WHERE trader_id=$1 AND match_group_id=$2 AND status='CANCELLED' AND cancellation_reason=$3`,
      [traderId, matchGroupId, COACH_CLAIM_EXPIRY_REASON],
    );
    const attempts = Number(attemptsResult.rows[0]?.attempts ?? 0);
    if (attempts >= COACH_NOW_MAX_REMATCH_ATTEMPTS) {
      status = "TERMINAL";
      await client.query("COMMIT");
    } else if (!expiredSessionId && attempts === 0) {
      await client.query("ROLLBACK");
      return { status: "NOT_EXPIRED", expired: false };
    } else {
      const base = sessions[0];
      const excludedCoachIds = sessions.map((session) => String(session.coach_id));
      const candidatesResult = await client.query(
        `SELECT c.*,
           EXISTS (
             SELECT 1 FROM tradigo_sessions prior
             WHERE prior.trader_id=$1 AND prior.coach_id=c.id AND prior.status='COMPLETED'
           ) AS has_repeat_relationship
         FROM tradigo_coaches c
         WHERE c.approved=true AND c.availability='AVAILABLE'
           AND NOT EXISTS (
             SELECT 1 FROM tradigo_conduct_reports cr
             WHERE cr.subject_user_id=c.id AND cr.status IN ('OPEN','IN_REVIEW')
           )
           AND COALESCE(c.profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
           AND NOT (c.id = ANY($2::text[]))`,
        [traderId, excludedCoachIds],
      );
      const capPerMinute = Math.floor(Number(base.authorized_amount_cents) / Math.max(1, Number(base.duration_minutes)));
      const selected = candidatesResult.rows
        .map((row) => ({
          row,
          ...scoreCoachForMatch(row, {
            instrumentClass: String(base.instrument_class || "GENERAL"),
            topic: String(base.topic || ""),
            language: "",
            maxRateCents: capPerMinute,
            traderId,
          }),
        }))
        .filter((candidate) => candidate.isEligible)
        .sort((left, right) => right.scoreBreakdown.totalScore - left.scoreBreakdown.totalScore)
        .slice(0, 3);

      if (!selected.length) {
        status = "TERMINAL";
        await client.query("COMMIT");
      } else {
        for (const candidate of selected) {
          await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${candidate.row.id}`]);
          const coachResult = await client.query(
            `SELECT * FROM tradigo_coaches
             WHERE id=$1 AND approved=true AND availability='AVAILABLE'
               AND COALESCE(profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
               AND NOT EXISTS (
                 SELECT 1 FROM tradigo_conduct_reports cr
                 WHERE cr.subject_user_id=tradigo_coaches.id AND cr.status IN ('OPEN','IN_REVIEW')
               )
             FOR UPDATE`,
            [candidate.row.id],
          );
          const coach = coachResult.rows[0] as Record<string, any> | undefined;
          if (!coach) continue;
          const policy = await evaluateCoachingPolicy(client, {
            traderId,
            coachId: String(coach.id),
            category: "GENERAL_EDUCATION",
            instrumentClass: String(base.instrument_class || "GENERAL"),
            topic: String(base.topic || ""),
            agenda: String(base.agenda || ""),
            learningGoal: "",
          });
          if (policy.decision === "DENIED") continue;
          const sessionId = `sess_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
          const rateCents = Number(coach.instant_rate_per_minute_cents);
          await client.query(
            `INSERT INTO tradigo_sessions
              (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,authorized_amount_cents,
               rate_snapshot_cents,currency,symbol,agenda,topic,coaching_category,instrument_class,payment_status,
               room_name,match_group_id,booking_idempotency_key)
             VALUES ($1,$2,$3,'INSTANT','REQUESTED',$4,$5,$5,$6,$7,$8,$9,$10,'GENERAL_EDUCATION',$11,'NOT_STARTED',$12,$13,$14)`,
            [
              sessionId, traderId, coach.id, base.duration_minutes, rateCents * Number(base.duration_minutes), rateCents,
              coach.currency, base.symbol ?? null, base.agenda, base.topic, base.instrument_class,
              `tradigo-${sessionId}`, matchGroupId, `match:${matchGroupId}:${coach.id}`,
            ],
          );
          await client.query(
            "INSERT INTO tradigo_rate_snapshots (id,session_id,coach_id,rate_cents,currency,policy) VALUES ($1,$2,$3,$4,$5,$6)",
            [randomUUID(), sessionId, coach.id, rateCents, coach.currency, { mode: "INSTANT", durationMinutes: base.duration_minutes, matchGroupId, rematchAttempt: attempts, feePercent: 15 }],
          );
          await client.query(
            `INSERT INTO tradigo_learning_records (id,session_id,trader_id,coach_id,learning_goal)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id) DO NOTHING`,
            [randomUUID(), sessionId, traderId, coach.id, base.topic || base.agenda],
          );
          await recordPolicyDecision(client, sessionId, traderId, policy);
          createdSessionIds.push(sessionId);
        }
        if (!createdSessionIds.length) {
          status = "TERMINAL";
          await client.query("COMMIT");
        } else {
          status = "REMATCHED";
          await client.query("COMMIT");
        }
      }
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (expiredSessionId) {
    await appendEvent(expiredSessionId, "system:coach-now-claim-expiry", "COACH_CLAIM_EXPIRED", { matchGroupId, failureClass: "EXPIRY" });
  }
  for (const sessionId of createdSessionIds) {
    await appendEvent(sessionId, traderId, "REQUESTED", { mode: "MATCH_REMATCHED", matchGroupId });
    await appendEvent(sessionId, traderId, "MATCH_REMATCHED", {
      outcome: "REMATCHED",
      nextAction: "WAIT_FOR_COACH_RESPONSE",
    });
    await appendEvent(sessionId, traderId, "MATCH_CONTACTED", {
      reasonCodes: [],
      outcome: "REMATCH_CONTACTED",
    });
  }
  return { status, expired: Boolean(expiredSessionId) };
}

function toTraderProfileDto(row: Record<string, any> | undefined, userId: string) {
  return {
    userId,
    experienceLevel: row?.experience_level ?? "BEGINNER",
    preferredMarkets: row?.preferred_markets ?? [],
    instruments: row?.instruments ?? [],
    tradingStyles: row?.trading_styles ?? [],
    methodologies: row?.methodologies ?? [],
    timezone: row?.timezone ?? undefined,
    onboardingCurrentStep: Number(row?.onboarding_current_step ?? 1),
    onboardingCompletedAt: row?.onboarding_completed_at ?? undefined,
    totalSessionsCompleted: Number(row?.total_sessions_completed ?? 0),
    totalSpentCents: Number(row?.total_spent_cents ?? 0),
    blockedCoachIds: row?.blocked_coach_ids ?? [],
  };
}

async function ensureDemoCatalog(): Promise<void> {
  await ensureSchedulingSchema();
  for (const coach of demoCoaches) {
    await pool.query(
      `INSERT INTO tradigo_coaches
       (id, display_name, avatar_url, headline, bio, markets, specialties, languages, years_of_experience,
        hourly_rate_cents, instant_rate_per_minute_cents, currency, verification_status, rating_average_tenths,
        rating_count, approved, availability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        coach.id,
        coach.displayName,
        coach.avatarUrl,
        coach.headline,
        coach.bio,
        coach.markets,
        coach.specialties,
        coach.languages,
        coach.yearsOfExperience,
        coach.hourlyRateCents,
        coach.instantRatePerMinuteCents,
        coach.currency,
        coach.verificationStatus,
        coach.ratingAverageTenths,
        coach.ratingCount,
        coach.id === "demo-coach-maya" ? "AVAILABLE" : "AWAY",
      ],
    );
    await pool.query(
      `UPDATE tradigo_coaches
       SET teaching_method = COALESCE(teaching_method, $2),
           coaching_boundaries = COALESCE(coaching_boundaries, $3)
       WHERE id=$1`,
      [coach.id, "Structured, example-led review with a written next practice step.", "Education only: no signals, guarantees, account access, or trade execution."],
    );
    await pool.query(
      `UPDATE tradigo_coaches
       SET availability_timezone='UTC', availability_min_notice_minutes=120,
           availability_booking_horizon_days=30, availability_buffer_minutes=10
       WHERE id=$1`,
      [coach.id],
    );
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM tradigo_coach_availability_rules WHERE coach_id=$1", [coach.id]);
    if (Number(count.rows[0]?.count ?? 0) === 0) {
      for (let weekday = 0; weekday <= 6; weekday += 1) {
        await pool.query(
          `INSERT INTO tradigo_coach_availability_rules (id,coach_id,weekday,start_minute,end_minute,timezone)
           VALUES ($1,$2,$3,0,1440,'UTC') ON CONFLICT (coach_id,weekday,start_minute,end_minute) DO NOTHING`,
          [randomUUID(), coach.id, weekday],
        );
      }
    }
  }
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function buildLiveKitToken(roomName: string, actor: { id: string; displayName?: string }): string | null {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!key || !secret || process.env.LIVE_ROOM_PROVIDER !== "livekit") return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: key,
    sub: actor.id,
    name: actor.displayName ?? actor.id,
    iat: now,
    exp: now + 60 * 30,
    video: { room: roomName, roomJoin: true, canPublish: true, canSubscribe: true },
  }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function paypalConfigured(): boolean {
  return process.env.PAYMENT_PROVIDER === "paypal" && Boolean(process.env.PAYPAL_CLIENT_ID) && Boolean(process.env.PAYPAL_CLIENT_SECRET || process.env.PAYMENT_PROVIDER_SECRET);
}

const NO_SHOW_GRACE_MINUTES = 10;
const UPCOMING_SESSION_STATUSES = ["REQUESTED", "COACH_CLAIMED", "PAYMENT_READY", "ROOM_READY"];
const AUTHORIZED_PAYMENT_STATUSES = ["PAYPAL_AUTHORIZED", "AUTHORIZED_SANDBOX"];
const COACH_NOW_ACTIVE_STATUSES = ["COACH_CLAIMED", "PAYMENT_READY", "ROOM_READY", "ACTIVE"];
const MAX_ACTIVE_COACH_NOW_REQUESTS = 1;
const COACH_NOW_CLAIM_SECONDS = 25;
const COACH_NOW_MAX_REMATCH_ATTEMPTS = 2;
const COACH_CLAIM_EXPIRY_REASON = "The coach claim expired before the trader confirmed.";
const PAYOUT_RETRY_DELAY_MINUTES = 5;
const VERIFIED_PAYPAL_OWNERSHIP_SOURCES = new Set(["PAYPAL_PARTNER_API", "PAYPAL_AUTHENTICATED_WEBHOOK"]);
const PAYOUT_ACCOUNT_REVERIFICATION_MESSAGE =
  "PayPal account ownership must be independently reverified before payouts can resume. Redirect confirmation alone is not proof of ownership.";
let payoutSchemaReady: Promise<void> | null = null;

function hasIndependentPayPalVerification(account: Record<string, any> | undefined): boolean {
  return Boolean(
    account
      && String(account.provider ?? "").toUpperCase() === "PAYPAL"
      && account.provider_account_id
      && account.ownership_verified_at
      && VERIFIED_PAYPAL_OWNERSHIP_SOURCES.has(String(account.ownership_verification_source ?? "")),
  );
}

function requiresPayPalReverification(account: Record<string, any> | undefined): boolean {
  return Boolean(
    account
      && String(account.provider ?? "").toUpperCase() === "PAYPAL"
      && ["READY", "VERIFIED"].includes(String(account.status ?? "").toUpperCase())
      && account.provider_account_id
      && !hasIndependentPayPalVerification(account),
  );
}

function payoutHoldMinutes(): number {
  const configured = Number(process.env.TRADIGO_PAYOUT_HOLD_MINUTES);
  return Number.isFinite(configured) && configured >= 0 ? Math.min(configured, 30 * 24 * 60) : 24 * 60;
}

function ensurePayoutSchema(): Promise<void> {
  if (!payoutSchemaReady) {
    payoutSchemaReady = pool.query(`
      SELECT to_regclass('public.tradigo_coach_payout_accounts') AS account_table,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tradigo_payouts' AND column_name='hold_until') AS has_hold_until,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tradigo_coach_payout_accounts' AND column_name='ownership_verified_at') AS has_ownership_verified_at,
             EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tradigo_coach_payout_accounts' AND column_name='ownership_verification_source') AS has_ownership_verification_source
    `).then(async (check) => {
      if (
        check.rows[0]?.account_table
        && check.rows[0]?.has_hold_until
        && check.rows[0]?.has_ownership_verified_at
        && check.rows[0]?.has_ownership_verification_source
      ) return;
      const client = await pool.connect();
      try {
        await client.query("SELECT pg_advisory_lock(682068)");
        await client.query(`
      CREATE TABLE IF NOT EXISTS tradigo_coach_payout_accounts (
        coach_id text PRIMARY KEY,
        provider text NOT NULL,
        status text NOT NULL DEFAULT 'NOT_STARTED',
        provider_account_id text,
        onboarding_reference text,
        onboarding_url text,
        failure_code text,
        failure_message text,
        verified_at timestamptz,
        ownership_verified_at timestamptz,
        ownership_verification_source text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE tradigo_coach_payout_accounts ADD COLUMN IF NOT EXISTS ownership_verified_at timestamptz;
      ALTER TABLE tradigo_coach_payout_accounts ADD COLUMN IF NOT EXISTS ownership_verification_source text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS provider_batch_id text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS provider_item_id text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS hold_until timestamptz;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS eligible_at timestamptz;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS failure_code text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS failure_message text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT true;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS reversal_reason text;
      ALTER TABLE tradigo_payouts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      CREATE INDEX IF NOT EXISTS tradigo_payouts_execution_idx ON tradigo_payouts(status, next_attempt_at, hold_until);
      CREATE INDEX IF NOT EXISTS tradigo_payouts_provider_reference_idx ON tradigo_payouts(provider_reference);
      CREATE INDEX IF NOT EXISTS tradigo_payouts_provider_batch_idx ON tradigo_payouts(provider_batch_id);
        `);
      } finally {
        await client.query("SELECT pg_advisory_unlock(682068)");
        client.release();
      }
    });
  }
  return payoutSchemaReady;
}

function cancellationPaymentStatus(paymentStatus: string): string {
  return paymentStatus === "PAYPAL_AUTHORIZED" ? "VOIDED" : "CANCELLED";
}

async function cancelSessionPayment(session: Record<string, any>, id: string): Promise<string> {
  if (session.payment_status === "PAYPAL_AUTHORIZED" && session.paypal_authorization_id) {
    if (!await voidPayPalAuthorization(String(session.paypal_authorization_id), `void:${id}`)) {
      throw new Error("PayPal could not release the authorization. The session remains active.");
    }
    return "VOIDED";
  }
  return cancellationPaymentStatus(String(session.payment_status));
}

async function cancelSessionSafely(session: Record<string, any>, actorId: string, reason: string, noShowType?: string): Promise<{ cancelled: boolean; paymentStatus: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.id)]);
    const lockedResult = await client.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [session.id]);
    const locked = lockedResult.rows[0] as Record<string, any> | undefined;
    if (!locked) {
      await client.query("ROLLBACK");
      return { cancelled: false, paymentStatus: "" };
    }
    if (String(locked.status) === "CANCELLED") {
      await client.query("COMMIT");
      return { cancelled: false, paymentStatus: String(locked.payment_status) };
    }
    if (!UPCOMING_SESSION_STATUSES.includes(String(locked.status))) {
      await client.query("ROLLBACK");
      throw new Error("Only upcoming sessions can be cancelled.");
    }
    const paymentStatus = await cancelSessionPayment(locked, String(locked.id));
    await client.query(
      `UPDATE tradigo_sessions
       SET status='CANCELLED', payment_status=$1, cancellation_reason=$2, cancelled_at=NOW(), cancelled_by=$3,
           no_show_type=$4, updated_at=NOW()
       WHERE id=$5`,
      [paymentStatus, reason, actorId, noShowType ?? null, locked.id],
    );
    await client.query("COMMIT");
    await appendCancellationEntries(locked, reason, actorId, noShowType);
    return { cancelled: true, paymentStatus };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

async function appendCancellationEntries(session: Record<string, any>, reason: string, actorId: string, noShowType?: string): Promise<void> {
  await appendEvent(String(session.id), actorId, noShowType ? `NO_SHOW_${noShowType}` : "SESSION_CANCELLED", {
    reason,
    noShowType: noShowType ?? null,
    authorizedAmountCents: Number(session.authorized_amount_cents ?? 0),
  });
}

export async function finalizeNoShow(session: Record<string, any>, actorId: string): Promise<boolean> {
  if (session.mode !== "SCHEDULED" || !session.scheduled_at || !UPCOMING_SESSION_STATUSES.includes(String(session.status))) return false;
  const scheduledEnd = new Date(new Date(session.scheduled_at).getTime() + Number(session.duration_minutes) * 60_000);
  if (Date.now() < scheduledEnd.getTime() + NO_SHOW_GRACE_MINUTES * 60_000) return false;
  const attendance = await pool.query(
    "SELECT DISTINCT participant_id FROM tradigo_attendance_events WHERE session_id=$1 AND event_type='JOIN'",
    [session.id],
  );
  const joined = new Set(attendance.rows.map((row) => String(row.participant_id)));
  const traderJoined = joined.has(String(session.trader_id));
  const coachJoined = joined.has(String(session.coach_id));
  const noShowType = traderJoined ? (coachJoined ? null : "COACH") : (coachJoined ? "TRADER" : "MUTUAL");
  if (!noShowType) return false;
  const reason = `${noShowType === "MUTUAL" ? "Both participants" : noShowType === "TRADER" ? "The trader" : "The coach"} did not attend the scheduled consultation.`;
  const result = await cancelSessionSafely(session, actorId, reason, noShowType);
  return result.cancelled;
}

export async function resolveDueNoShows(actorId = "system:no-show-worker"): Promise<{ scanned: number; resolved: number; failed: number }> {
  const due = await pool.query(
    `SELECT *
     FROM tradigo_sessions
     WHERE mode = 'SCHEDULED'
       AND status = ANY($1::text[])
       AND scheduled_at IS NOT NULL
       AND scheduled_at + (duration_minutes * interval '1 minute') + ($2 * interval '1 minute') <= NOW()
     ORDER BY scheduled_at
     LIMIT 100`,
    [UPCOMING_SESSION_STATUSES, NO_SHOW_GRACE_MINUTES],
  );

  let resolved = 0;
  let failed = 0;
  for (const session of due.rows) {
    try {
      if (await finalizeNoShow(session as Record<string, any>, actorId)) resolved += 1;
    } catch (error) {
      failed += 1;
      await recordNoShowResolutionFailure(session as Record<string, any>, actorId, error);
    }
  }
  return { scanned: due.rowCount ?? due.rows.length, resolved, failed };
}

async function recordNoShowResolutionFailure(session: Record<string, any>, actorId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "No-show resolution failed.";
  const existing = await pool.query(
    `SELECT id FROM tradigo_session_events
     WHERE session_id=$1 AND event_type='NO_SHOW_RESOLUTION_FAILED'
       AND created_at > NOW() - interval '10 minutes'
     LIMIT 1`,
    [session.id],
  );
  if (existing.rowCount) return;
  await appendEvent(String(session.id), actorId, "NO_SHOW_RESOLUTION_FAILED", {
    message,
    paymentStatus: session.payment_status,
    scheduledAt: session.scheduled_at,
    retryable: true,
    nextAction: "Retry automatically on the next worker pass; investigate if the failure persists.",
  });
}

function paypalApiBase(): string {
  return process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYMENT_PROVIDER_SECRET;
  if (!paypalConfigured() || !clientId || !clientSecret) return null;
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const accessResponse = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!accessResponse.ok) return null;
    const access = await accessResponse.json() as { access_token?: string };
    return access.access_token ?? null;
  } catch {
    return null;
  }
}

function paypalCheckoutRequestId(sessionId: string): string {
  // Keep this stable across retries. PayPal can create the order even when
  // the response is lost, so a retry must replay the same provider call.
  return `tradigo-${sessionId}`;
}

async function createPayPalOrder(amountCents: number, sessionId: string, currency: string): Promise<{ orderId?: string; approvalUrl?: string; connected: boolean }> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { connected: false };
  try {
    const orderResponse = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": paypalCheckoutRequestId(sessionId),
      },
      body: JSON.stringify({
        intent: "AUTHORIZE",
        purchase_units: [{
          reference_id: sessionId,
          description: "Tradigo coaching session authorization",
          amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) },
        }],
      }),
    });
    if (!orderResponse.ok) return { connected: false };
    const order = await orderResponse.json() as { id?: string; links?: Array<{ rel: string; href: string }> };
    return {
      connected: Boolean(order.id),
      orderId: order.id,
      approvalUrl: order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href,
    };
  } catch {
    return { connected: false };
  }
}

async function authorizePayPalOrder(orderId: string, idempotencyKey = `tradigo-authorize-${orderId}`): Promise<{ authorized: boolean; authorizationId?: string; authorizationStatus?: string; authorizationExpiresAt?: string }> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { authorized: false };
  try {
    const response = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
      },
    });
    if (!response.ok) return { authorized: false };
    const order = await response.json() as {
      status?: string;
      purchase_units?: Array<{ payments?: { authorizations?: Array<{ id?: string; status?: string; expiration_time?: string }> } }>;
    };
    const authorization = order.purchase_units?.[0]?.payments?.authorizations?.[0];
    return {
      authorized: order.status === "COMPLETED" && Boolean(authorization?.id),
      authorizationId: authorization?.id,
      authorizationStatus: authorization?.status,
      authorizationExpiresAt: authorization?.expiration_time,
    };
  } catch {
    return { authorized: false };
  }
}

function paypalAuthorizationRequestId(sessionId: string): string {
  // Keep this stable across retries. PayPal can have created the hold even
  // when the response is lost, so a retry must replay the same provider call.
  return `authorize:${sessionId}`;
}

async function verifyPayPalOrder(orderId: string, session: Record<string, unknown>): Promise<boolean> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return false;
  try {
    const response = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return false;
    const order = await response.json() as { purchase_units?: Array<{ reference_id?: string; amount?: { currency_code?: string; value?: string } }> };
    const unit = order.purchase_units?.[0];
    return Boolean(unit) && unit!.reference_id === session.id
      && unit!.amount?.currency_code === session.currency
      && Math.round(Number(unit!.amount?.value) * 100) === Number(session.authorized_amount_cents);
  } catch { return false; }
}

export async function capturePayPalAuthorization(
  authorizationId: string,
  idempotencyKey: string,
  amountCents: number,
  currency: string,
): Promise<{ captured: boolean; captureId?: string }> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { captured: false };
  try {
    const response = await fetch(`${paypalApiBase()}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "PayPal-Request-Id": idempotencyKey },
      body: JSON.stringify({
        amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) },
        final_capture: true,
      }),
    });
    if (!response.ok) return { captured: false };
    const capture = await response.json() as { id?: string };
    return { captured: true, captureId: capture.id };
  } catch { return { captured: false }; }
}

export async function voidPayPalAuthorization(authorizationId: string, idempotencyKey: string): Promise<boolean> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return false;
  try {
    const response = await fetch(`${paypalApiBase()}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "PayPal-Request-Id": idempotencyKey },
    });
    return response.ok;
  } catch { return false; }
}

export async function refundPayPalCapture(captureId: string, idempotencyKey: string): Promise<{ ok: boolean; refundId?: string; status?: string; error?: string }> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { ok: false, error: "PayPal credentials are not configured." };
  try {
    const response = await fetch(`${paypalApiBase()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "PayPal-Request-Id": idempotencyKey },
    });
    const body = await response.json().catch(() => ({})) as { id?: string; status?: string; name?: string; message?: string };
    return { ok: response.ok, refundId: body.id, status: body.status, error: response.ok ? undefined : `${body.name || "PAYPAL_ERROR"}: ${body.message || response.statusText}` };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "PayPal refund request failed." }; }
}

type PayPalPayoutResult = {
  ok: boolean;
  status?: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  batchId?: string;
  itemId?: string;
  errorCode?: string;
  error?: string;
  retryable?: boolean;
};

function payoutFailureRetryable(code: string | undefined, status: number): boolean {
  if (["RECEIVER_UNREGISTERED", "RECEIVER_ACCOUNT_LOCKED", "RECEIVER_COUNTRY_NOT_SUPPORTED", "INVALID_DESTINATION"].includes(code ?? "")) return false;
  return status >= 500 || ["INSTRUMENT_DECLINED", "TRANSACTION_REFUSED", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR"].includes(code ?? "");
}

export async function createPayPalPayout(
  payoutId: string,
  providerAccountId: string,
  amountCents: number,
  currency: string,
  idempotencyKey: string,
): Promise<PayPalPayoutResult> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { ok: false, errorCode: "PAYPAL_NOT_CONFIGURED", error: "PayPal payout credentials are not configured.", retryable: true };
  try {
    const response = await fetch(`${paypalApiBase()}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": idempotencyKey,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: idempotencyKey,
          email_subject: "Your Tradigo coaching earnings are on the way",
          email_message: "Tradigo has released your coaching earnings.",
        },
        items: [{
          recipient_type: "PAYPAL_ID",
          receiver: providerAccountId,
          sender_item_id: payoutId,
          amount: { value: (amountCents / 100).toFixed(2), currency },
          note: "Tradigo coaching earnings",
        }],
      }),
    });
    const body = await response.json().catch(() => ({})) as {
      name?: string;
      message?: string;
      details?: Array<{ issue?: string; description?: string }>;
      batch_header?: { payout_batch_id?: string; batch_status?: string };
      items?: Array<{ payout_item_id?: string; transaction_status?: string }>;
    };
    const detail = body.details?.[0];
    const errorCode = detail?.issue || body.name;
    if (!response.ok) {
      return {
        ok: false,
        errorCode,
        error: detail?.description || body.message || response.statusText || "PayPal payout request failed.",
        retryable: payoutFailureRetryable(errorCode, response.status),
      };
    }
    const item = body.items?.[0];
    const status = body.batch_header?.batch_status === "SUCCESS" || item?.transaction_status === "SUCCESS"
      ? "SUCCESS"
      : body.batch_header?.batch_status === "PROCESSING" || item?.transaction_status === "PROCESSING"
        ? "PROCESSING"
        : "PENDING";
    return {
      ok: true,
      status,
      batchId: body.batch_header?.payout_batch_id,
      itemId: item?.payout_item_id,
      retryable: false,
    };
  } catch (error) {
    return { ok: false, errorCode: "PROVIDER_UNAVAILABLE", error: error instanceof Error ? error.message : "PayPal payout request failed.", retryable: true };
  }
}

export async function getPayPalPayoutStatus(batchId: string, itemId?: string): Promise<PayPalPayoutResult> {
  const accessToken = await paypalAccessToken();
  if (!accessToken) return { ok: false, errorCode: "PAYPAL_NOT_CONFIGURED", error: "PayPal payout credentials are not configured.", retryable: true };
  try {
    const suffix = itemId ? `/items/${encodeURIComponent(itemId)}` : "";
    const response = await fetch(`${paypalApiBase()}/v1/payments/payouts/${encodeURIComponent(batchId)}${suffix}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json().catch(() => ({})) as {
      name?: string;
      message?: string;
      batch_header?: { payout_batch_id?: string; batch_status?: string };
      items?: Array<{ payout_item_id?: string; transaction_status?: string; errors?: { name?: string; message?: string } }>;
      transaction_status?: string;
      errors?: { name?: string; message?: string };
    };
    const item = body.items?.[0];
    const providerStatus = item?.transaction_status || body.transaction_status || body.batch_header?.batch_status;
    const status = providerStatus === "SUCCESS" ? "SUCCESS"
      : ["FAILED", "BLOCKED", "RETURNED", "REVERSED", "CANCELED", "UNCLAIMED"].includes(providerStatus ?? "") ? "FAILED"
        : providerStatus === "PROCESSING" ? "PROCESSING" : "PENDING";
    if (!response.ok) {
      const errorCode = item?.errors?.name || body.errors?.name || body.name;
      return { ok: false, status: "FAILED", errorCode, error: item?.errors?.message || body.errors?.message || body.message || response.statusText, retryable: payoutFailureRetryable(errorCode, response.status) };
    }
    return { ok: true, status, batchId: body.batch_header?.payout_batch_id || batchId, itemId: item?.payout_item_id || itemId, errorCode: item?.errors?.name, error: item?.errors?.message, retryable: false };
  } catch (error) {
    return { ok: false, errorCode: "PROVIDER_UNAVAILABLE", error: error instanceof Error ? error.message : "PayPal payout status request failed.", retryable: true };
  }
}

function payoutOnboardingState(coachId: string, reference: string, expiresAt: number): string {
  const payload = `${coachId}.${reference}.${expiresAt}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET || "tradigo-payout-state").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parsePayoutOnboardingState(state: string): { coachId: string; reference: string; expiresAt: number } | null {
  const [coachId, reference, expiresAtValue, signature] = state.split(".");
  const expiresAt = Number(expiresAtValue);
  if (!coachId || !reference || !signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const payload = `${coachId}.${reference}.${expiresAt}`;
  const expected = createHmac("sha256", process.env.SESSION_SECRET || "tradigo-payout-state").update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null;
  return { coachId, reference, expiresAt };
}

async function createPayPalPayoutOnboardingLink(coachId: string, reference: string, returnUrl: string): Promise<string | null> {
  const configuredUrl = process.env.PAYPAL_PAYOUT_ONBOARDING_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    url.searchParams.set("tracking_id", reference);
    url.searchParams.set("return_url", returnUrl);
    return url.toString();
  }
  const accessToken = await paypalAccessToken();
  if (!accessToken) return null;
  try {
    const response = await fetch(`${paypalApiBase()}/v2/customer/partner-referrals`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(process.env.PAYPAL_PARTNER_ATTRIBUTION_ID ? { "PayPal-Partner-Attribution-Id": process.env.PAYPAL_PARTNER_ATTRIBUTION_ID } : {}),
      },
      body: JSON.stringify({
        tracking_id: reference,
        operations: [{ operation: "API_INTEGRATION", api_integration_preference: { rest_api_integration: { integration_method: "PAYPAL", integration_type: "THIRD_PARTY" }, rest_third_party_details: { features: ["PAYMENT", "REFUND", "PAYOUTS"] } } }],
        products: ["PAYOUTS"],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
        partner_config_override: { return_url: returnUrl },
      }),
    });
    const body = await response.json().catch(() => ({})) as { links?: Array<{ rel?: string; href?: string }> };
    return response.ok ? body.links?.find((link) => link.rel === "action_url")?.href ?? null : null;
  } catch {
    return null;
  }
}

export async function verifyPayPalWebhook(headers: Record<string, string>, webhookEvent: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const accessToken = await paypalAccessToken();
  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const certUrl = headers["paypal-cert-url"];
  const authAlgo = headers["paypal-auth-algo"];
  if (!webhookId || !accessToken || !transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return false;
  try {
    const response = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });
    if (!response.ok) return false;
    const result = await response.json() as { verification_status?: string };
    return result.verification_status === "SUCCESS";
  } catch { return false; }
}

function paypalResourceIds(resource: Record<string, any>): string[] {
  return [
    resource.id,
    resource.custom_id,
    resource.reference_id,
    resource.supplementary_data?.related_ids?.order_id,
    resource.supplementary_data?.related_ids?.authorization_id,
    resource.supplementary_data?.related_ids?.capture_id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function reconcilePayPalEvent(event: Record<string, any>): Promise<{ sessionId?: string; status: string; error?: string }> {
  if (String(event.event_type || "").startsWith("PAYMENT.PAYOUTS-ITEM.")) {
    return reconcilePayPalPayoutEvent(event);
  }
  const resource = (event.resource || {}) as Record<string, any>;
  const ids = paypalResourceIds(resource);
  if (!ids.length) return { status: "FAILED", error: "PayPal event did not contain a provider reference." };
  const sessionResult = await pool.query(
    `SELECT * FROM tradigo_sessions
     WHERE paypal_order_id = ANY($1::text[]) OR paypal_authorization_id = ANY($1::text[])
        OR id = ANY($1::text[])
        OR id IN (SELECT session_id FROM tradigo_payment_intents WHERE provider_reference = ANY($1::text[]))
     LIMIT 1`,
    [ids],
  );
  const session = sessionResult.rows[0] as Record<string, any> | undefined;
  if (!session) return { status: "FAILED", error: `No Tradigo session matched PayPal references: ${ids.join(", ")}` };

  const eventType = String(event.event_type || "");
  const providerReference = String(resource.id || ids[0]);
  const amountCents = Math.round(Number(resource.amount?.value || resource.amount?.gross_amount?.value || session.final_amount_cents || session.authorized_amount_cents || 0) * 100);
  const amount = amountCents > 0 ? amountCents : Number(session.final_amount_cents || session.authorized_amount_cents || 0);
  let status = "RECONCILED";
  let paymentStatus: string | null = null;
  let intentStatus = "RECONCILED";
  if (eventType === "PAYMENT.AUTHORIZATION.CREATED") paymentStatus = "PAYPAL_AUTHORIZED";
  else if (eventType === "PAYMENT.CAPTURE.COMPLETED") paymentStatus = "PAYPAL_SETTLED";
  else if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "PAYMENT.CAPTURE.REVERSED") {
    paymentStatus = "RECONCILIATION_FAILED"; intentStatus = "FAILED"; status = "FAILED";
  } else if (eventType === "PAYMENT.AUTHORIZATION.VOIDED") paymentStatus = "VOIDED";
  else if (eventType === "PAYMENT.REFUND.PENDING") { paymentStatus = "REFUND_PENDING"; intentStatus = "PENDING"; }
  else if (eventType === "PAYMENT.REFUNDED") paymentStatus = "REFUNDED";
  else if (eventType === "PAYMENT.REFUND.FAILED") {
    paymentStatus = "REFUND_FAILED"; intentStatus = "FAILED"; status = "FAILED";
  } else return { sessionId: String(session.id), status: "IGNORED", error: `Unsupported PayPal event ${eventType}` };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tradigo_payment_intents (id, session_id, provider, provider_reference, kind, amount_cents, currency, status, idempotency_key, details)
       VALUES ($1,$2,'PAYPAL',$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (idempotency_key) DO UPDATE SET status=EXCLUDED.status, provider_reference=COALESCE(EXCLUDED.provider_reference, tradigo_payment_intents.provider_reference), details=EXCLUDED.details`,
      [randomUUID(), session.id, providerReference, eventType.includes("REFUND") ? "REFUND" : eventType.includes("CAPTURE") ? "CAPTURE" : eventType.includes("AUTHORIZATION") ? "AUTHORIZE" : "WEBHOOK", amount, session.currency, intentStatus, `paypal-webhook:${event.id}`, { eventType, resourceId: resource.id, status: resource.status }],
    );
    const frozen = status === "FAILED" ? ", payout_status='FROZEN'" : "";
    if (paymentStatus) {
      await client.query(`UPDATE tradigo_sessions SET payment_status=$1${frozen}, updated_at=NOW() WHERE id=$2`, [paymentStatus, session.id]);
    }
    if (eventType === "PAYMENT.CAPTURE.COMPLETED" && resource.id) {
      await client.query("UPDATE tradigo_payment_intents SET provider_reference=$1 WHERE session_id=$2 AND kind='CAPTURE' AND status IN ('SETTLED','RECONCILED')", [resource.id, session.id]);
    }
    if (eventType === "PAYMENT.REFUNDED") {
      const payout = await client.query("SELECT * FROM tradigo_payouts WHERE session_id=$1 FOR UPDATE", [session.id]);
      const coachNet = Number(payout.rows[0]?.amount_cents || session.coach_net_cents || 0);
      await client.query(`UPDATE tradigo_payouts SET status='REFUNDED', provider_reference=$1 WHERE session_id=$2`, [providerReference, session.id]);
      const refundEntries = [
        ["REFUND", "customer_clearing", amount],
        ["REFUND", "platform_cash", -amount],
        ["REFUND_COACH", "coach_payable", coachNet],
        ["REFUND_COACH", "platform_cash", -coachNet],
      ];
      for (const [index, [entryType, account, entryAmount]] of refundEntries.entries()) {
        await client.query(`INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (idempotency_key) DO NOTHING`,
          [randomUUID(), session.id, entryType, account, entryAmount, session.currency, `refund:${event.id}:${index}`, { providerReference }]);
      }
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  await recordMarketplaceEvent(pool, {
    eventType: eventType === "PAYMENT.REFUNDED"
      ? "REFUND_COMPLETED"
      : eventType === "PAYMENT.REFUND.FAILED"
        ? "REFUND_FAILED"
        : status === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_RECONCILED",
    sessionId: String(session.id),
    actorId: "system:paypal",
    details: {
      failureClass: status === "FAILED" ? "PAYMENT_FAILURE" : undefined,
      providerStatus: String(resource.status || ""),
      outcome: status,
    },
    eventKey: `paypal-reconciliation:${event.id}:${eventType}`,
  });
  return { sessionId: String(session.id), status };
}

function payoutEventReferenceIds(resource: Record<string, any>): string[] {
  return [
    ...paypalResourceIds(resource),
    resource.payout_item_id,
    resource.sender_batch_id,
    resource.transaction_id,
    resource.sender_item_id,
    resource.payout_item?.payout_item_id,
    resource.payout_item?.sender_item_id,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function reconcilePayPalPayoutEvent(event: Record<string, any>): Promise<{ sessionId?: string; status: string; error?: string }> {
  await ensurePayoutSchema();
  const resource = (event.resource || {}) as Record<string, any>;
  const ids = payoutEventReferenceIds(resource);
  if (!ids.length) return { status: "FAILED", error: "PayPal payout event did not contain a provider reference." };
  const payoutResult = await pool.query(
    `SELECT p.*, s.currency AS session_currency
     FROM tradigo_payouts p
     JOIN tradigo_sessions s ON s.id=p.session_id
     WHERE p.provider_reference = ANY($1::text[])
        OR p.provider_batch_id = ANY($1::text[])
        OR p.provider_item_id = ANY($1::text[])
        OR p.id = ANY($1::text[])
     LIMIT 1`,
    [ids],
  );
  const payout = payoutResult.rows[0] as Record<string, any> | undefined;
  if (!payout) return { status: "FAILED", error: `No Tradigo payout matched PayPal references: ${ids.join(", ")}` };
  const eventType = String(event.event_type || "");
  const failed = eventType.endsWith(".FAILED") || eventType.endsWith(".BLOCKED") || eventType.endsWith(".CANCELED") || eventType.endsWith(".UNCLAIMED");
  const reversed = eventType.endsWith(".RETURNED") || eventType.endsWith(".REVERSED");
  const nextStatus = eventType.endsWith(".SUCCEEDED") ? "PAID" : reversed ? "REVERSED" : failed ? "FAILED" : "PENDING";
  const providerReference = String(resource.transaction_id || resource.payout_item_id || resource.id || payout.provider_reference || "");
  const failureCode = String(resource.error?.name || resource.errors?.name || resource.failure_reason || (failed ? eventType.split(".").at(-1) : "") || "") || null;
  const failureMessage = String(resource.error?.message || resource.errors?.message || resource.failure_reason || "") || null;
  const reversalReason = reversed ? failureMessage || eventType.split(".").at(-1) || "PayPal returned the payout." : null;
  const amount = Number(payout.amount_cents);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM tradigo_payouts WHERE id=$1 FOR UPDATE", [payout.id]);
    await client.query(
      `UPDATE tradigo_payouts
       SET status=$1, provider_reference=COALESCE($2, provider_reference),
           provider_batch_id=COALESCE($3, provider_batch_id), provider_item_id=COALESCE($4, provider_item_id),
           failure_code=$5, failure_message=$6, retryable=$7,
           reversed_at=CASE WHEN $1='REVERSED' THEN NOW() ELSE reversed_at END,
           reversal_reason=COALESCE($8, reversal_reason), next_attempt_at=NULL, updated_at=NOW()
       WHERE id=$9`,
      [nextStatus, providerReference || null, resource.sender_batch_id || resource.payout_batch_id || null, resource.payout_item_id || null, failureCode, failureMessage, false, reversalReason, payout.id],
    );
    await client.query(
      `UPDATE tradigo_sessions SET payout_status=$1, updated_at=NOW() WHERE id=$2`,
      [nextStatus, payout.session_id],
    );
    const details = { eventId: event.id, eventType, providerReference, failureCode, failureMessage, reversalReason };
    const statusEntryType = nextStatus === "PAID" ? "PAYOUT_PAID" : nextStatus === "REVERSED" ? "PAYOUT_REVERSED" : nextStatus === "FAILED" ? "PAYOUT_FAILED" : "PAYOUT_PENDING";
    await client.query(
      `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
       VALUES ($1,$2,$3,'coach_payable',$4,$5,$6,$7) ON CONFLICT (idempotency_key) DO NOTHING`,
      [randomUUID(), payout.session_id, statusEntryType, nextStatus === "PAID" ? -amount : nextStatus === "REVERSED" ? amount : 0, payout.currency || payout.session_currency, `payout:webhook:${event.id}`, details],
    );
    if (nextStatus === "PAID") {
      await client.query(
        `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
         VALUES ($1,$2,'PAYOUT_PAID','platform_cash',$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING`,
        [randomUUID(), payout.session_id, amount, payout.currency || payout.session_currency, `payout:webhook:${event.id}:cash`, details],
      );
    } else if (nextStatus === "REVERSED") {
      await client.query(
        `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
         VALUES ($1,$2,'PAYOUT_REVERSED','platform_cash',$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING`,
        [randomUUID(), payout.session_id, -amount, payout.currency || payout.session_currency, `payout:webhook:${event.id}:cash`, details],
      );
    }
    if (["PAID", "FAILED"].includes(nextStatus)) {
      await recordMarketplaceEvent(client, {
        eventType: `PAYOUT_${nextStatus}`,
        sessionId: String(payout.session_id),
        actorId: "system:paypal",
        details,
        eventKey: `payout-webhook:${event.id}`,
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { sessionId: String(payout.session_id), status: "RECONCILED" };
}

type PayoutBlock = { code: string; message: string; nextAction: string };

async function payoutBlockReason(client: any, payout: Record<string, any>): Promise<PayoutBlock | null> {
  const sessionResult = await client.query(
    `SELECT s.*, c.approved, c.verification_status, u.status AS coach_account_status,
             a.provider AS payout_account_provider, a.status AS payout_account_status, a.provider_account_id,
             a.ownership_verified_at, a.ownership_verification_source,
             a.failure_code AS account_failure_code, a.failure_message AS account_failure_message
     FROM tradigo_sessions s
     JOIN tradigo_coaches c ON c.id=s.coach_id
     LEFT JOIN tradigo_users u ON u.id=s.coach_id
     LEFT JOIN tradigo_coach_payout_accounts a ON a.coach_id=s.coach_id
     WHERE s.id=$1`,
    [payout.session_id],
  );
  const session = sessionResult.rows[0] as Record<string, any> | undefined;
  if (!session) return { code: "SESSION_NOT_FOUND", message: "The completed session could not be found.", nextAction: "Contact Tradigo support." };
  if (session.status !== "COMPLETED" || !["SETTLED_SANDBOX", "PAYPAL_SETTLED"].includes(String(session.payment_status))) {
    return { code: "SESSION_NOT_SETTLED", message: "The session payment has not been fully settled.", nextAction: "Tradigo will keep this payout on hold until payment is settled." };
  }
  if (session.dispute_status !== "NONE") {
    return { code: "DISPUTE_OPEN", message: "This payout is frozen while the session dispute is open or being resolved.", nextAction: "Wait for the dispute review to finish." };
  }
  const openDispute = await client.query("SELECT 1 FROM tradigo_disputes WHERE session_id=$1 AND status='OPEN' LIMIT 1", [payout.session_id]);
  if (openDispute.rowCount) return { code: "DISPUTE_OPEN", message: "This payout is frozen while the session dispute is open.", nextAction: "Wait for the dispute review to finish." };
  if (session.approved !== true) return { code: "COACH_NOT_APPROVED", message: "Coach approval is required before earnings can be released.", nextAction: "Contact Tradigo support if your approval status is incorrect." };
  if (["SUSPENDED", "BANNED", "DELETED"].includes(String(session.coach_account_status))) {
    return { code: "COACH_ACCOUNT_BLOCKED", message: "Payouts are paused because the coach account is not active.", nextAction: "Resolve the account restriction before requesting payout." };
  }
  if (["DECLINED", "EXPIRED", "UNAVAILABLE"].includes(String(session.verification_status))) {
    return { code: "PROVIDER_VERIFICATION_FAILED", message: "The payout provider could not verify the coach account.", nextAction: "Complete provider verification again or contact Tradigo support." };
  }
  const payoutAccount = {
    provider: session.payout_account_provider,
    provider_account_id: session.provider_account_id,
    ownership_verified_at: session.ownership_verified_at,
    ownership_verification_source: session.ownership_verification_source,
  };
  const payoutAccountIsReady = Boolean(session.provider_account_id)
    && ["READY", "VERIFIED"].includes(String(session.payout_account_status));
  if (payoutAccountIsReady && !hasIndependentPayPalVerification(payoutAccount)) {
    return {
      code: "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED",
      message: PAYOUT_ACCOUNT_REVERIFICATION_MESSAGE,
      nextAction: "Keep earnings on hold and contact Tradigo support to arrange independent PayPal verification.",
    };
  }
  if (!session.provider_account_id || !["READY", "VERIFIED"].includes(String(session.payout_account_status))) {
    const message = session.account_failure_message || "A payout account has not been connected.";
    return { code: session.account_failure_code || "PAYOUT_SETUP_REQUIRED", message, nextAction: "Complete the separate PayPal payout onboarding before the hold can be released." };
  }
  if (!hasIndependentPayPalVerification(payoutAccount)) {
    return {
      code: "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED",
      message: PAYOUT_ACCOUNT_REVERIFICATION_MESSAGE,
      nextAction: "Keep earnings on hold and contact Tradigo support to arrange independent PayPal verification.",
    };
  }
  return null;
}

async function appendPayoutLedger(client: any, payout: Record<string, any>, entryType: string, amountCents: number, details: Record<string, unknown>, suffix: string): Promise<void> {
  await client.query(
    `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (idempotency_key) DO NOTHING`,
    [randomUUID(), payout.session_id, entryType, entryType === "PAYOUT_PAID" || entryType === "PAYOUT_REVERSED" ? "coach_payable" : "coach_payable", amountCents, payout.currency, `payout:${payout.id}:${suffix}`, details],
  );
}

export async function attemptPayout(payoutId: string, actorId = "system:payout-worker"): Promise<{ status: string; skipped?: boolean; reason?: PayoutBlock }> {
  await ensurePayoutSchema();
  await ensureSchedulingSchema();
  const client = await pool.connect();
  let payout: Record<string, any> | undefined;
  let pollExisting = false;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT p.*, s.status AS session_status, s.payment_status, s.dispute_status
       FROM tradigo_payouts p JOIN tradigo_sessions s ON s.id=p.session_id
       WHERE p.id=$1 FOR UPDATE`,
      [payoutId],
    );
    payout = result.rows[0] as Record<string, any> | undefined;
    if (!payout) { await client.query("ROLLBACK"); return { status: "NOT_FOUND", skipped: true }; }
    if (["PAID", "REVERSED", "REFUNDED", "FROZEN"].includes(String(payout.status))) {
      await client.query("COMMIT");
      return { status: String(payout.status), skipped: true };
    }
    const now = Date.now();
    const holdDue = payout.hold_until && new Date(payout.hold_until).getTime() > now;
    const pendingDue = payout.status === "PENDING" && payout.next_attempt_at && new Date(payout.next_attempt_at).getTime() > now;
    const processingFresh = payout.status === "PROCESSING" && payout.last_attempt_at && new Date(payout.last_attempt_at).getTime() > now - 10 * 60_000;
    if (holdDue || pendingDue || processingFresh) {
      await client.query("COMMIT");
      return { status: String(payout.status), skipped: true };
    }
    const block = await payoutBlockReason(client, payout);
    if (block) {
      const verificationHold = block.code === "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED";
      const payoutStatus = verificationHold ? "VERIFICATION_HOLD" : "BLOCKED";
      await client.query(
        `UPDATE tradigo_payouts SET status=$1, failure_code=$2, failure_message=$3, retryable=false, next_attempt_at=NULL, updated_at=NOW() WHERE id=$4`,
        [payoutStatus, block.code, block.message, payout.id],
      );
      await client.query("UPDATE tradigo_sessions SET payout_status=$1, updated_at=NOW() WHERE id=$2", [payoutStatus, payout.session_id]);
      await appendPayoutLedger(
        client,
        payout,
        verificationHold ? "PAYOUT_VERIFICATION_HOLD" : "PAYOUT_BLOCKED",
        0,
        { actorId, code: block.code, message: block.message, nextAction: block.nextAction },
        verificationHold ? "verification-hold" : `blocked:${block.code}`,
      );
      await client.query("COMMIT");
      return { status: payoutStatus, reason: block };
    }
    pollExisting = payout.status === "PENDING" && Boolean(payout.provider_batch_id || payout.provider_reference);
    const nextAttemptCount = pollExisting ? Number(payout.attempt_count || 0) : Number(payout.attempt_count || 0) + 1;
    await client.query(
      `UPDATE tradigo_payouts
       SET status='PROCESSING', attempt_count=$1, last_attempt_at=NOW(), next_attempt_at=NULL, eligible_at=COALESCE(eligible_at, NOW()), updated_at=NOW()
       WHERE id=$2`,
      [nextAttemptCount, payout.id],
    );
    if (payout.status === "HELD" || payout.status === "VERIFICATION_HOLD") {
      await client.query("UPDATE tradigo_sessions SET payout_status='ELIGIBLE', updated_at=NOW() WHERE id=$1", [payout.session_id]);
      await appendPayoutLedger(
        client,
        payout,
        "PAYOUT_ELIGIBLE",
        0,
        { actorId },
        payout.status === "HELD" ? "eligible" : "verification-released",
      );
    }
    await appendPayoutLedger(client, payout, "PAYOUT_PROCESSING", 0, { actorId, attempt: nextAttemptCount }, `processing:${nextAttemptCount}`);
    payout = { ...payout, attempt_count: nextAttemptCount, status: "PROCESSING" };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (!payout) return { status: "NOT_FOUND", skipped: true };

  const requestId = `tradigo-payout:${payout.id}`;
  const result = pollExisting
    ? await getPayPalPayoutStatus(String(payout.provider_batch_id || payout.provider_reference), payout.provider_item_id || undefined)
    : await createPayPalPayout(String(payout.id), String((await pool.query("SELECT provider_account_id FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [payout.coach_id])).rows[0]?.provider_account_id || ""), Number(payout.amount_cents), String(payout.currency), requestId);
  const finishClient = await pool.connect();
  try {
    await finishClient.query("BEGIN");
    const lockedResult = await finishClient.query("SELECT * FROM tradigo_payouts WHERE id=$1 FOR UPDATE", [payout.id]);
    const locked = lockedResult.rows[0] as Record<string, any> | undefined;
    if (!locked) { await finishClient.query("ROLLBACK"); return { status: "NOT_FOUND", skipped: true }; }
    const details = { actorId, attempt: locked.attempt_count, providerReference: result.itemId || result.batchId || null, errorCode: result.errorCode || null, error: result.error || null };
    if (result.ok && result.status === "SUCCESS") {
      const providerReference = result.itemId || result.batchId || locked.provider_reference;
      await finishClient.query(
        `UPDATE tradigo_payouts SET status='PAID', provider_reference=COALESCE($1,provider_reference), provider_batch_id=COALESCE($2,provider_batch_id), provider_item_id=COALESCE($3,provider_item_id), failure_code=NULL, failure_message=NULL, retryable=false, next_attempt_at=NULL, updated_at=NOW() WHERE id=$4`,
        [providerReference, result.batchId, result.itemId, locked.id],
      );
      await finishClient.query("UPDATE tradigo_sessions SET payout_status='PAID', updated_at=NOW() WHERE id=$1", [locked.session_id]);
      await appendPayoutLedger(finishClient, locked, "PAYOUT_PAID", -Number(locked.amount_cents), details, `paid:${providerReference || "provider"}`);
      await finishClient.query(
        `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
         VALUES ($1,$2,'PAYOUT_PAID','platform_cash',$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING`,
        [randomUUID(), locked.session_id, Number(locked.amount_cents), locked.currency, `payout:${locked.id}:paid:${providerReference || "provider"}:cash`, details],
      );
      await recordMarketplaceEvent(finishClient, {
        eventType: "PAYOUT_PAID",
        sessionId: String(locked.session_id),
        actorId,
        details,
        eventKey: `payout:${locked.id}:paid:${providerReference || "provider"}`,
      });
      await finishClient.query("COMMIT");
      return { status: "PAID" };
    }
    if (result.ok && (result.status === "PENDING" || result.status === "PROCESSING")) {
      const providerReference = result.itemId || result.batchId || locked.provider_reference;
      await finishClient.query(
        `UPDATE tradigo_payouts SET status='PENDING', provider_reference=COALESCE($1,provider_reference), provider_batch_id=COALESCE($2,provider_batch_id), provider_item_id=COALESCE($3,provider_item_id), retryable=false, next_attempt_at=NOW() + ($4 * interval '1 minute'), updated_at=NOW() WHERE id=$5`,
        [providerReference, result.batchId, result.itemId, PAYOUT_RETRY_DELAY_MINUTES, locked.id],
      );
      await finishClient.query("UPDATE tradigo_sessions SET payout_status='PENDING', updated_at=NOW() WHERE id=$1", [locked.session_id]);
      await appendPayoutLedger(finishClient, locked, "PAYOUT_PENDING", 0, details, `pending:${locked.attempt_count}`);
      await finishClient.query("COMMIT");
      return { status: "PENDING" };
    }
    const retryable = result.retryable !== false;
    const failureCode = result.errorCode || "PAYOUT_PROVIDER_FAILED";
    const failureMessage = result.error || "The payout provider rejected the transfer.";
    await finishClient.query(
      `UPDATE tradigo_payouts SET status='FAILED', failure_code=$1, failure_message=$2, retryable=$3, next_attempt_at=CASE WHEN $3 THEN NOW() + ($4 * interval '1 minute') ELSE NULL END, updated_at=NOW() WHERE id=$5`,
      [failureCode, failureMessage, retryable, PAYOUT_RETRY_DELAY_MINUTES, locked.id],
    );
    await finishClient.query("UPDATE tradigo_sessions SET payout_status='FAILED', updated_at=NOW() WHERE id=$1", [locked.session_id]);
    await appendPayoutLedger(finishClient, locked, "PAYOUT_FAILED", 0, { ...details, retryable }, `failed:${locked.attempt_count}`);
    await recordMarketplaceEvent(finishClient, {
      eventType: "PAYOUT_FAILED",
      sessionId: String(locked.session_id),
      actorId,
      details: { ...details, retryable },
      eventKey: `payout:${locked.id}:failed:${locked.attempt_count}`,
    });
    await finishClient.query("COMMIT");
    return { status: "FAILED" };
  } catch (error) {
    await finishClient.query("ROLLBACK");
    throw error;
  } finally {
    finishClient.release();
  }
}

export async function resolveDuePayouts(actorId = "system:payout-worker"): Promise<{ scanned: number; attempted: number; paid: number; failed: number; blocked: number; held: number }> {
  await ensurePayoutSchema();
  const due = await pool.query(
    `SELECT p.id
     FROM tradigo_payouts p
     WHERE (p.status='HELD' AND (p.hold_until IS NULL OR p.hold_until <= NOW()))
        OR (p.status='ELIGIBLE')
        OR (p.status='FAILED' AND p.retryable=true AND (p.next_attempt_at IS NULL OR p.next_attempt_at <= NOW()))
        OR (p.status='PENDING' AND p.next_attempt_at IS NOT NULL AND p.next_attempt_at <= NOW())
        OR (p.status='PROCESSING' AND p.last_attempt_at <= NOW() - interval '10 minutes')
         OR (p.status='VERIFICATION_HOLD' AND EXISTS (
           SELECT 1
           FROM tradigo_coach_payout_accounts a
           WHERE a.coach_id=p.coach_id
             AND a.provider='PAYPAL'
             AND a.status IN ('READY','VERIFIED')
             AND a.provider_account_id IS NOT NULL
             AND a.ownership_verified_at IS NOT NULL
             AND a.ownership_verification_source IN ('PAYPAL_PARTNER_API','PAYPAL_AUTHENTICATED_WEBHOOK')
         ))
     ORDER BY p.created_at
     LIMIT 100`,
  );
  const counts = { scanned: due.rowCount ?? due.rows.length, attempted: 0, paid: 0, failed: 0, blocked: 0, held: 0 };
  for (const row of due.rows) {
    try {
      const result = await attemptPayout(String(row.id), actorId);
      if (!result.skipped) counts.attempted += 1;
      if (result.status === "PAID") counts.paid += 1;
      if (result.status === "FAILED") counts.failed += 1;
      if (result.status === "BLOCKED") counts.blocked += 1;
      if (result.status === "VERIFICATION_HOLD") counts.held += 1;
    } catch {
      counts.failed += 1;
    }
  }
  return counts;
}

/** Deterministic interval metering: reconnect gaps <=60 seconds remain one visit. */
export function attendanceOverlapSeconds(
  events: Array<{ participantId: string; eventType: string; occurredAt: Date }>,
  traderId: string, coachId: string, capSeconds: number, now = Date.now(),
): number {
  const intervals = (participantId: string) => {
    const rows = events.filter((event) => event.participantId === participantId).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    const output: Array<[number, number]> = []; let joined: number | null = null;
    for (const event of rows) {
      const at = event.occurredAt.getTime();
      if (event.eventType === "JOIN" && joined === null) joined = at;
      if (event.eventType === "LEAVE" && joined !== null) { output.push([joined, at]); joined = null; }
    }
    if (joined !== null) output.push([joined, now]);
    return output.reduce<Array<[number, number]>>((merged, interval) => {
      const previous = merged.at(-1);
      if (previous && interval[0] - previous[1] <= 60_000) previous[1] = Math.max(previous[1], interval[1]);
      else merged.push(interval);
      return merged;
    }, []);
  };
  let seconds = 0;
  for (const a of intervals(traderId)) for (const b of intervals(coachId)) seconds += Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0])) / 1000;
  return Math.min(capSeconds, Math.floor(seconds));
}

async function findSession(id: string) {
  const result = await pool.query("SELECT * FROM tradigo_sessions WHERE id = $1", [id]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

const PAYMENT_SETUP_RETRY_EVENT = "PAYMENT_SETUP_RETRYING";
const paymentSetupRetryMessage = "Tradigo is safely retrying payment setup. Keep this page open and do not start another checkout.";

async function recordPaymentSetupRetry(sessionId: string, actorId: string): Promise<void> {
  const existing = await pool.query(
    `SELECT id
     FROM tradigo_session_events
     WHERE session_id=$1 AND event_type=$2
       AND created_at > NOW() - interval '10 minutes'
     LIMIT 1`,
    [sessionId, PAYMENT_SETUP_RETRY_EVENT],
  );
  if (existing.rowCount) return;
  await appendEvent(sessionId, actorId, PAYMENT_SETUP_RETRY_EVENT, {
    message: paymentSetupRetryMessage,
    retryable: true,
    nextAction: "Tradigo will retry the existing payment setup. Refresh this session to see the PayPal approval link when it is available.",
  });
}

function toSessionDto(row: Record<string, unknown>) {
  const authorizationExpiresAt = row.paypal_authorization_expires_at;
  const expiresAtMs = authorizationExpiresAt ? new Date(String(authorizationExpiresAt)).getTime() : NaN;
  const authorizationExpired = Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
  const authorizationExpiringSoon = Number.isFinite(expiresAtMs) && !authorizationExpired
    && expiresAtMs <= Date.now() + 24 * 60 * 60 * 1000;
  const noShowFailureDetails = row.no_show_resolution_failure_details as Record<string, unknown> | null | undefined;
  const noShowResolutionFailure = row.no_show_resolution_failure_id
    ? {
      id: row.no_show_resolution_failure_id,
      createdAt: row.no_show_resolution_failure_created_at,
      message: String(noShowFailureDetails?.message ?? "No-show settlement could not be completed safely."),
      paymentStatus: noShowFailureDetails?.paymentStatus ?? row.payment_status,
      retryable: noShowFailureDetails?.retryable !== false,
      nextAction: String(noShowFailureDetails?.nextAction ?? "Tradigo will retry automatically; contact support if this persists."),
    }
    : null;
  const payout = row.payout_id
    ? {
      id: row.payout_id,
      status: row.payout_provider_status ?? row.payout_status,
      providerReference: row.payout_provider_reference ?? null,
      providerBatchId: row.payout_provider_batch_id ?? null,
      providerItemId: row.payout_provider_item_id ?? null,
      holdUntil: row.payout_hold_until ?? null,
      eligibleAt: row.payout_eligible_at ?? null,
      attemptCount: Number(row.payout_attempt_count ?? 0),
      nextAttemptAt: row.payout_next_attempt_at ?? null,
      lastAttemptAt: row.payout_last_attempt_at ?? null,
      failureCode: row.payout_failure_code ?? null,
      failureMessage: row.payout_failure_message ?? null,
      retryable: row.payout_retryable !== false,
      reversedAt: row.payout_reversed_at ?? null,
      reversalReason: row.payout_reversal_reason ?? null,
      blockingReasons: row.payout_failure_code && row.payout_failure_message
        ? [{ code: row.payout_failure_code, message: row.payout_failure_message }]
        : [],
    }
    : null;
  return {
    id: row.id,
    traderId: row.trader_id,
    coachId: row.coach_id,
    mode: row.mode,
    status: row.status,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    amountCents: row.amount_cents,
    symbol: row.symbol ?? null,
    agenda: row.agenda,
    topic: row.topic,
    instrumentClass: row.instrument_class ?? "GENERAL",
    currency: row.currency,
    rateSnapshotCents: Number(row.rate_snapshot_cents ?? 0),
    authorizedAmountCents: row.authorized_amount_cents,
    finalAmountCents: row.final_amount_cents,
    billableSeconds: row.billable_seconds,
    platformFeeCents: row.platform_fee_cents,
    coachNetCents: row.coach_net_cents,
    payoutStatus: row.payout_status,
    payout,
    disputeStatus: row.dispute_status,
    endReason: row.end_reason,
    cancellationReason: row.cancellation_reason,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    noShowType: row.no_show_type,
    rescheduledFrom: row.rescheduled_from,
    sessionStartedAt: row.started_at,
    paymentStatus: row.payment_status,
    coachClaimedAt: row.coach_claimed_at ?? null,
    coachClaimExpiresAt: row.coach_claim_expires_at ?? null,
    traderConfirmedAt: row.trader_confirmed_at ?? null,
    traderDeclinedAt: row.trader_declined_at ?? null,
    paymentApprovalUrl: row.payment_approval_url,
    paypalAuthorizationId: row.paypal_authorization_id,
    paypalAuthorizationStatus: row.paypal_authorization_status,
    paypalAuthorizationExpiresAt: authorizationExpiresAt,
    paypalAuthorizationExpired: authorizationExpired,
    paypalAuthorizationExpiringSoon: authorizationExpiringSoon,
    paymentNextAction: authorizationExpired
      ? "Payment authorization expired. Contact support before starting or capturing this session."
      : authorizationExpiringSoon
        ? "Payment authorization expires soon. Start the session before the expiry or contact support to renew the hold."
        : null,
    roomName: row.room_name,
    completedAt: row.completed_at,
    matchGroupId: row.match_group_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    learningGoal: row.learning_goal ?? null,
    learningStatus: row.learning_status ?? null,
    noShowResolutionFailure,
  };
}

function toConductReportDto(row: Record<string, unknown>) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    subjectUserId: row.subject_user_id,
    sessionId: row.session_id,
    reason: row.reason,
    details: row.details,
    evidenceReference: row.evidence_reference ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function notificationDetails(eventType: string, details: Record<string, unknown> | null, sessionId: string): Record<string, unknown> {
  if (eventType === "CONDUCT_REPORT_RESOLVED" || eventType === "CONDUCT_REPORT_DISMISSED") {
    return {
      outcome: eventType === "CONDUCT_REPORT_RESOLVED" ? "RESOLVED" : "DISMISSED",
      sessionReference: sessionId,
    };
  }
  return details ?? {};
}

function notificationTitle(eventType: string): string {
  if (eventType === "CONDUCT_REPORT_RESOLVED") return "Conduct report resolved";
  if (eventType === "CONDUCT_REPORT_DISMISSED") return "Conduct report dismissed";
  return eventType.replaceAll("_", " ");
}

function notificationBody(eventType: string, details: Record<string, unknown> | null, sessionId: string): string {
  if (eventType === "CONDUCT_REPORT_RESOLVED") return `Your conduct report for session ${sessionId} was resolved.`;
  if (eventType === "CONDUCT_REPORT_DISMISSED") return `Your conduct report for session ${sessionId} was dismissed.`;
  return typeof details?.message === "string" ? details.message : "";
}

function notificationActionPath(eventType: string, sessionId: string, role: ApplicationIdentity["role"]): string | null {
  if (!eventType.startsWith("CONDUCT_REPORT_")) return null;
  return `${role === "COACH" ? "/coach" : "/app"}/sessions/${encodeURIComponent(sessionId)}`;
}

function applicationNotificationId(value: string): string | null {
  const match = /^application-clarification-(.+)$/.exec(value);
  return match?.[1] || null;
}

function applicationNotificationActionPath(applicationId: string, role: ApplicationIdentity["role"]): string {
  const reviewerPath = role === "ADMIN" ? "/admin" : "/moderator";
  return `${reviewerPath}/applications?applicationId=${encodeURIComponent(applicationId)}`;
}

async function applicationClarificationNotifications(actor: ApplicationIdentity): Promise<Array<Record<string, unknown>>> {
  if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") return [];
  const tableResult = await pool.query("SELECT to_regclass('public.tradigo_application_clarifications') AS table_name");
  if (!tableResult.rows[0]?.table_name) return [];

  const result = await pool.query(
    `SELECT c.id, c.application_id, c.created_at, a.attempt_number, ns.read_at
     FROM tradigo_application_clarifications c
     JOIN tradigo_coach_applications a ON a.id=c.application_id
     LEFT JOIN tradigo_application_notification_states ns
       ON ns.user_id=$1 AND ns.clarification_id=c.id
     WHERE c.status='SUBMITTED' AND ns.archived_at IS NULL
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT 30`,
    [actor.id],
  );

  return result.rows.map((row) => ({
    id: `application-clarification-${row.id}`,
    type: "APPLICATION_CLARIFICATION_SUBMITTED",
    title: "Application clarification requested",
    applicationId: row.application_id,
    details: {
      applicationId: row.application_id,
      attemptNumber: Number(row.attempt_number ?? 1),
    },
    body: `An applicant requested clarification on application attempt ${Number(row.attempt_number ?? 1)}.`,
    actionPath: applicationNotificationActionPath(String(row.application_id), actor.role),
    createdAt: row.created_at,
    read: Boolean(row.read_at),
    readAt: row.read_at,
  }));
}

function toLearningRecordDto(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    traderId: row.trader_id,
    coachId: row.coach_id,
    learningGoal: row.learning_goal,
    conceptsReviewed: row.concepts_reviewed,
    evidenceDiscussed: row.evidence_discussed,
    sharedArtifact: row.shared_artifact,
    unresolvedQuestions: row.unresolved_questions,
    practiceSteps: row.practice_steps,
    traderReflection: row.trader_reflection,
    status: row.status,
    coachCompletedAt: row.coach_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function appendEvent(sessionId: string, actorId: string, eventType: string, details: Record<string, unknown> = {}): Promise<void> {
  await ensureSchedulingSchema();
  await pool.query(
    "INSERT INTO tradigo_session_events (session_id, actor_id, event_type, details) VALUES ($1,$2,$3,$4)",
    [sessionId, actorId, eventType, details],
  );
  await recordMarketplaceEvent(pool, { eventType, sessionId, actorId, details });
}

async function authenticatedUserPayload(actor: ApplicationIdentity): Promise<Record<string, unknown> | null> {
  if (actor.kind !== "FIREBASE" && actor.kind !== "LOCAL") return null;
  await pool.query(
    `INSERT INTO tradigo_trader_profiles (user_id)
     SELECT $1 WHERE $2 = 'TRADER'
     ON CONFLICT (user_id) DO NOTHING`,
    [actor.id, actor.role],
  );
  const [userResult, traderResult, applicationResult, coachResult] = await Promise.all([
    pool.query("SELECT id, email, display_name, avatar_url, role, status, country_code, email_verified_at, created_at, updated_at FROM tradigo_users WHERE id=$1", [actor.id]),
    pool.query("SELECT * FROM tradigo_trader_profiles WHERE user_id=$1", [actor.id]),
    pool.query(
      "SELECT status FROM tradigo_coach_applications WHERE applicant_id=$1 ORDER BY created_at DESC, updated_at DESC, id DESC LIMIT 1",
      [actor.id],
    ).catch(() => ({ rows: [] })),
    pool.query("SELECT * FROM tradigo_coaches WHERE id=$1", [actor.id]),
  ]);
  const user = userResult.rows[0] as Record<string, any> | undefined;
  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      ...(user.avatar_url ? { avatarUrl: user.avatar_url } : {}),
      role: user.role,
      status: user.status,
      countryCode: user.country_code,
      emailVerified: Boolean(user.email_verified_at),
      emailVerifiedAt: user.email_verified_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    traderProfile: user.role === "TRADER" ? toTraderProfileDto(traderResult.rows[0], actor.id) : null,
    coachProfile: user.role === "COACH" && coachResult.rows[0] ? toCoachDto(coachResult.rows[0]) : null,
    coachApplicationStatus: applicationResult.rows[0]?.status ?? null,
  };
}

router.get("/auth/me", async (req, res): Promise<void> => {
  const actor = await getApplicationIdentity(req);
  if (!actor) {
    res.status(401).json({ error: { message: "Sign in is required." } });
    return;
  }
  const payload = await authenticatedUserPayload(actor);
  if (payload) {
    res.json(payload);
    return;
  }
  res.json({
    user: {
      id: actor.id,
      email: actor.email ?? `${actor.role.toLowerCase()}@demo.tradigo.app`,
      displayName: actor.displayName ?? actor.id,
      role: actor.role,
      status: actor.status ?? "ACTIVE",
      countryCode: "US",
    },
    coachApplicationStatus: actor.role === "COACH" ? "APPROVED" : null,
  });
});

type LocalAuthTokenKind = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

function configuredAuthActionBaseUrl(): string | null {
  const configured = process.env.TRADIGO_PUBLIC_URL?.trim();
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) return null;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function authActionBaseUrl(req: Request): string | null {
  const configured = configuredAuthActionBaseUrl();
  if (configured) return configured;
  // Never build production auth links from a request Host header. A canonical
  // public URL must be configured before mail delivery can be enabled.
  if (process.env.NODE_ENV === "production") return null;
  const forwardedProtocol = req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${forwardedProtocol || req.protocol}://${req.get("host")}`;
}

function authDeliveryConfigured(req: Request): boolean {
  return authEmailDeliveryConfigured() && Boolean(authActionBaseUrl(req));
}

async function issueLocalAuthToken(userId: string, tokenKind: LocalAuthTokenKind, ttlMs: number): Promise<{ token: string; tokenId: string }> {
  const rawToken = createAuthToken();
  const tokenId = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM tradigo_users WHERE id=$1 FOR UPDATE", [userId]);
    await client.query(
      `INSERT INTO tradigo_auth_tokens (id, user_id, token_hash, token_kind, expires_at)
       VALUES ($1,$2,$3,$4,NOW() + ($5 * interval '1 millisecond'))`,
      [tokenId, userId, hashAuthToken(rawToken), tokenKind, ttlMs],
    );
    await client.query("COMMIT");
    return { token: rawToken, tokenId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function queueLocalAuthEmail(
  req: Request,
  user: { id: string; email: string; displayName: string },
  tokenKind: LocalAuthTokenKind,
): Promise<boolean> {
  const baseUrl = authActionBaseUrl(req);
  if (!baseUrl || !authEmailDeliveryConfigured()) return false;
  const ttlMs = tokenKind === "EMAIL_VERIFICATION" ? EMAIL_VERIFICATION_TTL_MS : PASSWORD_RESET_TTL_MS;
  const issued = await issueLocalAuthToken(user.id, tokenKind, ttlMs);
  const encryptedToken = encryptAuthToken(issued.token);
  if (!encryptedToken) return false;
  await pool.query(
    `INSERT INTO tradigo_auth_email_outbox
     (id,token_id,user_id,email_kind,recipient,recipient_name,encrypted_token,action_base_url,expires_in_hours)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      randomUUID(),
      issued.tokenId,
      user.id,
      tokenKind === "EMAIL_VERIFICATION" ? "verification" : "password-reset",
      user.email,
      user.displayName,
      encryptedToken,
      baseUrl,
      tokenKind === "EMAIL_VERIFICATION" ? 24 : 1,
    ],
  );
  return true;
}

router.post("/auth/local/signup", async (req, res): Promise<void> => {
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: { message: "Built-in account creation is unavailable." } });
    return;
  }
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 160) : "";
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (displayName.length < 2 || !email || !email.includes("@")) {
    res.status(400).json({ error: { message: "Enter a valid name and email address." } });
    return;
  }
  if (!passwordIsValid(password)) {
    res.status(400).json({ error: { message: "Choose a password with 8 characters, an uppercase letter, a lowercase letter, and a number." } });
    return;
  }
  if (req.body?.consentAccepted !== true) {
    res.status(400).json({ error: { message: "Education-only terms and privacy consent are required." } });
    return;
  }

  await ensureIdentitySchema();
  const userId = `usr_local_${randomUUID()}`;
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tradigo_users
       (id, firebase_uid, email, email_normalized, display_name, role, password_hash, consent_accepted_at, consent_version)
       VALUES ($1,$2,$3,$4,$5,'TRADER',$6,NOW(),$7)`,
      [userId, `local:${userId}`, email, email, displayName, passwordHash, "education-only-v1"],
    );
    await client.query("INSERT INTO tradigo_trader_profiles (user_id) VALUES ($1)", [userId]);
    await client.query("COMMIT");
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error?.code === "23505") {
      res.status(409).json({ error: { message: "An account already exists for that email." } });
      return;
    }
    res.status(500).json({ error: { message: "We could not create your account." } });
    return;
  } finally {
    client.release();
  }

  const session = signLocalSession(userId, 0);
  if (!session) {
    res.status(503).json({ error: { message: "Built-in account creation is unavailable." } });
    return;
  }
  res.clearCookie(DEMO_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  res.cookie(LOCAL_SESSION_COOKIE, session, localCookieOptions());
  const verificationQueued = await queueLocalAuthEmail(req, { id: userId, email, displayName }, "EMAIL_VERIFICATION");
  const payload = await authenticatedUserPayload({
    id: userId,
    role: "TRADER",
    email,
    displayName,
    status: "ACTIVE",
    countryCode: "US",
    kind: "LOCAL",
  });
  res.status(201).json({
    ...payload,
    verification: {
      available: true,
      sent: false,
      queued: verificationQueued,
      status: "PENDING",
      deliveryConfigured: authDeliveryConfigured(req),
    },
  });
});

async function reserveLocalLoginAttempt(attemptKey: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const keyHash = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`local-login-v1\u0000${attemptKey}`)
    .digest("hex");
  await pool.query("DELETE FROM tradigo_local_login_throttles WHERE updated_at < NOW() - INTERVAL '24 hours'");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tradigo_local_login_throttles (key_hash,attempt_count,window_started_at,updated_at)
       VALUES ($1,0,NOW(),NOW()) ON CONFLICT (key_hash) DO NOTHING`,
      [keyHash],
    );
    const selected = await client.query(
      `SELECT attempt_count, locked_until,
              locked_until > NOW() AS is_locked,
              window_started_at <= NOW() - ($2::double precision * INTERVAL '1 millisecond') AS window_expired
       FROM tradigo_local_login_throttles WHERE key_hash=$1 FOR UPDATE`,
      [keyHash, LOCAL_LOGIN_FAILURE_WINDOW_MS],
    );
    const current = selected.rows[0] as { attempt_count: number; locked_until: Date | string | null; is_locked: boolean; window_expired: boolean };
    if (current.is_locked) {
      const retryAfterMs = Math.max(0, new Date(current.locked_until as Date | string).getTime() - Date.now());
      await client.query("COMMIT");
      return { allowed: false, retryAfterMs };
    }
    if (current.window_expired) {
      await client.query(
        `UPDATE tradigo_local_login_throttles
         SET attempt_count=1, window_started_at=NOW(), locked_until=NULL, updated_at=NOW()
         WHERE key_hash=$1`,
        [keyHash],
      );
      await client.query("COMMIT");
      return { allowed: true, retryAfterMs: 0 };
    }
    if (Number(current.attempt_count) >= LOCAL_LOGIN_MAX_ATTEMPTS) {
      const locked = await client.query(
        `UPDATE tradigo_local_login_throttles
         SET locked_until=NOW() + ($2 * INTERVAL '1 millisecond'), updated_at=NOW()
         WHERE key_hash=$1 RETURNING locked_until`,
        [keyHash, LOCAL_LOGIN_LOCKOUT_MS],
      );
      const retryAfterMs = Math.max(0, new Date(locked.rows[0].locked_until).getTime() - Date.now());
      await client.query("COMMIT");
      return { allowed: false, retryAfterMs };
    }
    await client.query(
      "UPDATE tradigo_local_login_throttles SET attempt_count=attempt_count+1, updated_at=NOW() WHERE key_hash=$1",
      [keyHash],
    );
    await client.query("COMMIT");
    return { allowed: true, retryAfterMs: 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function clearLocalLoginAttempts(attemptKey: string): Promise<void> {
  const keyHash = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`local-login-v1\u0000${attemptKey}`)
    .digest("hex");
  await pool.query("DELETE FROM tradigo_local_login_throttles WHERE key_hash=$1", [keyHash]);
}

router.post("/auth/local/login", async (req, res): Promise<void> => {
  const genericLoginFailure = (status = 401) => {
    res.status(status).json({ error: { message: "That email and password combination could not be verified." } });
  };
  if (!process.env.SESSION_SECRET) {
    res.status(503).json({ error: { message: "Built-in sign-in is unavailable." } });
    return;
  }
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: { message: "Enter your email and password." } });
    return;
  }

  const requestOrigin = req.ip || req.socket.remoteAddress || "unknown";
  const attemptKey = localLoginAttemptKey(email, requestOrigin);
  await ensureIdentitySchema();
  const throttle = await reserveLocalLoginAttempt(attemptKey);
  if (!throttle.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(throttle.retryAfterMs / 1000)));
    genericLoginFailure(429);
    return;
  }

  const result = await pool.query(
    `SELECT id, email, display_name, role, status, country_code, password_hash, local_session_version, email_verified_at
     FROM tradigo_users WHERE email_normalized=$1 AND firebase_uid LIKE 'local:%'`,
    [email],
  );
  const row = result.rows[0] as Record<string, any> | undefined;
  const validPassword = row?.password_hash ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !validPassword || row.status !== "ACTIVE") {
    genericLoginFailure();
    return;
  }

  const session = signLocalSession(String(row.id), Number(row.local_session_version ?? 0));
  if (!session) {
    res.status(503).json({ error: { message: "Built-in sign-in is unavailable." } });
    return;
  }
  await clearLocalLoginAttempts(attemptKey);
  res.clearCookie(DEMO_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  res.cookie(LOCAL_SESSION_COOKIE, session, localCookieOptions());
  const payload = await authenticatedUserPayload({
    id: String(row.id),
    role: row.role as ApplicationIdentity["role"],
    email: String(row.email),
    displayName: String(row.display_name),
    status: row.status as ApplicationIdentity["status"],
    countryCode: String(row.country_code ?? "US"),
    kind: "LOCAL",
  });
  res.json({
    ...payload,
    verification: {
      available: true,
      sent: true,
      status: row.email_verified_at ? "VERIFIED" : "PENDING",
      deliveryConfigured: authDeliveryConfigured(req),
    },
  });
});

router.post("/auth/local/verification/resend", async (req, res): Promise<void> => {
  const actor = await localIdentityFromRequest(req);
  if (!actor) {
    res.status(401).json({ error: { message: "Sign in is required." } });
    return;
  }
  await ensureIdentitySchema();
  const result = await pool.query(
    "SELECT email, display_name, email_verified_at FROM tradigo_users WHERE id=$1 AND firebase_uid LIKE 'local:%'",
    [actor.id],
  );
  const user = result.rows[0] as Record<string, any> | undefined;
  if (!user) {
    res.status(404).json({ error: { message: "Account not found." } });
    return;
  }
  if (user.email_verified_at) {
    res.json({ verification: { available: true, sent: false, status: "VERIFIED", deliveryConfigured: authDeliveryConfigured(req) } });
    return;
  }
  const queued = await queueLocalAuthEmail(req, {
    id: actor.id,
    email: String(user.email),
    displayName: String(user.display_name),
  }, "EMAIL_VERIFICATION");
  res.json({
    verification: {
      available: true,
      sent: false,
      queued,
      status: "PENDING",
      deliveryConfigured: authDeliveryConfigured(req),
    },
  });
});

router.post("/auth/local/verification/complete", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token) {
    res.status(400).json({ error: { code: "INVALID_VERIFICATION_TOKEN", message: "This verification link is invalid." } });
    return;
  }
  await ensureIdentitySchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT t.id, t.user_id, t.expires_at, t.consumed_at, u.email_verified_at
       FROM tradigo_auth_tokens t
       JOIN tradigo_users u ON u.id=t.user_id
       WHERE t.token_hash=$1 AND t.token_kind='EMAIL_VERIFICATION' AND t.activated_at IS NOT NULL
       FOR UPDATE`,
      [hashAuthToken(token)],
    );
    const row = result.rows[0] as Record<string, any> | undefined;
    if (!row) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: { code: "INVALID_VERIFICATION_TOKEN", message: "This verification link is invalid." } });
      return;
    }
    if (row.email_verified_at) {
      await client.query("ROLLBACK");
      res.json({ status: "COMPLETED", emailVerified: true });
      return;
    }
    if (row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      res.status(410).json({ error: { code: "EXPIRED_VERIFICATION_TOKEN", message: "This verification link has expired. Request a new one from your account." } });
      return;
    }
    await client.query("UPDATE tradigo_users SET email_verified_at=NOW(), updated_at=NOW() WHERE id=$1", [row.user_id]);
    await client.query("UPDATE tradigo_auth_tokens SET consumed_at=NOW() WHERE id=$1", [row.id]);
    await client.query("COMMIT");
    res.json({ status: "COMPLETED", emailVerified: true });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: "We could not verify your email." } });
  } finally {
    client.release();
  }
});

router.post("/auth/local/password-reset/request", async (req, res): Promise<void> => {
  const startedAt = Date.now();
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  // This response is intentionally identical for missing, Firebase, and local
  // accounts so the endpoint cannot be used to enumerate registered emails.
  const response = { message: "If an account exists for that email, a password reset link is on its way." };
  if (email && email.includes("@")) {
    await ensureIdentitySchema();
    const result = await pool.query(
      `SELECT id, email, display_name FROM tradigo_users
       WHERE email_normalized=$1 AND firebase_uid LIKE 'local:%' AND password_hash IS NOT NULL AND status='ACTIVE'`,
      [email],
    );
    const user = result.rows[0] as Record<string, any> | undefined;
    if (user) {
      await queueLocalAuthEmail(req, {
        id: String(user.id),
        email: String(user.email),
        displayName: String(user.display_name),
      }, "PASSWORD_RESET");
    }
  }
  const remainingDelay = 150 - (Date.now() - startedAt);
  if (remainingDelay > 0) await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  res.status(202).json(response);
});

router.post("/auth/local/password-reset/complete", async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || !passwordIsValid(password)) {
    res.status(400).json({ error: { code: "INVALID_PASSWORD_RESET", message: "Use a password with 8 characters, an uppercase letter, a lowercase letter, and a number." } });
    return;
  }
  await ensureIdentitySchema();
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, user_id, expires_at, consumed_at
       FROM tradigo_auth_tokens
       WHERE token_hash=$1 AND token_kind='PASSWORD_RESET' AND activated_at IS NOT NULL
       FOR UPDATE`,
      [hashAuthToken(token)],
    );
    const row = result.rows[0] as Record<string, any> | undefined;
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      res.status(410).json({ error: { code: "EXPIRED_PASSWORD_RESET", message: "This password reset link is invalid or has expired. Request a new one." } });
      return;
    }
    await client.query(
      "UPDATE tradigo_users SET password_hash=$1, local_session_version=local_session_version+1, updated_at=NOW() WHERE id=$2 AND firebase_uid LIKE 'local:%'",
      [passwordHash, row.user_id],
    );
    await client.query("UPDATE tradigo_auth_tokens SET consumed_at=NOW() WHERE id=$1", [row.id]);
    await client.query("UPDATE tradigo_auth_tokens SET consumed_at=NOW() WHERE user_id=$1 AND token_kind='PASSWORD_RESET' AND consumed_at IS NULL", [row.user_id]);
    await client.query("COMMIT");
    res.json({ status: "COMPLETED" });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: "We could not reset your password." } });
  } finally {
    client.release();
  }
});

router.post("/auth/local/logout", async (req, res): Promise<void> => {
  const actor = await localIdentityFromRequest(req);
  if (actor) {
    await pool.query("UPDATE tradigo_users SET local_session_version=local_session_version+1, updated_at=NOW() WHERE id=$1", [actor.id]);
  }
  res.clearCookie(LOCAL_SESSION_COOKIE, { ...localCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.post("/auth/demo", (req, res): void => {
  const role = req.body?.role as unknown;
  if (!demoModeEnabled() || (role !== "TRADER" && role !== "COACH")) {
    res.status(404).json({ error: { message: "Demo sessions are unavailable." } });
    return;
  }
  const actor = demoActors[role];
  const expiresAt = Date.now() + DEMO_SESSION_TTL_MS;
  const previewToken = signDemoSession(actor, expiresAt);
  res.cookie(DEMO_SESSION_COOKIE, previewToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: DEMO_SESSION_TTL_MS,
    path: "/",
  });
  res.json({ expiresAt, previewToken });
});

router.post("/auth/demo/logout", (_req, res): void => {
  res.clearCookie(DEMO_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
  res.status(204).end();
});

router.get("/marketplace/coaches", async (req, res): Promise<void> => {
  await ensureIdentitySchema();
  await ensureDemoCatalog();
  const viewer = await getApplicationIdentity(req);
  const viewerId = viewer?.role === "TRADER" ? viewer.id : "";
  const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const market = typeof req.query.market === "string" ? req.query.market.trim().toUpperCase() : "";
  const specialty = typeof req.query.specialty === "string" ? req.query.specialty.trim().toUpperCase() : "";
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim().toUpperCase() : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "RELEVANCE";
  const orderBy = sort === "PRICE_LOW_TO_HIGH"
    ? "c.hourly_rate_cents ASC"
    : sort === "PRICE_HIGH_TO_LOW"
      ? "c.hourly_rate_cents DESC"
      : sort === "EXPERIENCE"
        ? "c.years_of_experience DESC"
        : sort === "RATING"
          ? "c.rating_average_tenths DESC"
          : "c.availability = 'AVAILABLE' DESC, c.rating_average_tenths DESC";
  const result = await pool.query(
    `SELECT c.*,
       COALESCE(metrics.completed_session_count, 0) AS completed_session_count,
       metrics.session_reliability_percent,
       metrics.average_response_minutes,
       metrics.response_sample_count,
        metrics.reliability_sample_count,
        EXISTS (
          SELECT 1 FROM tradigo_favorites f
          WHERE f.trader_id = $5 AND f.coach_id = c.id
        ) AS is_favorited
     FROM tradigo_coaches c
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE s.status = 'COMPLETED')::int AS completed_session_count,
          CASE WHEN COUNT(*) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED')) > 0
            THEN ROUND(100.0 * COUNT(*) FILTER (WHERE s.status = 'COMPLETED') / COUNT(*) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED')), 0)
           ELSE NULL END AS session_reliability_percent,
         CASE WHEN COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL) > 0
           THEN ROUND(AVG(EXTRACT(EPOCH FROM (accepted.created_at - s.created_at)) / 60)
             FILTER (WHERE accepted.created_at IS NOT NULL), 0)
           ELSE NULL END AS average_response_minutes
          ,COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL)::int AS response_sample_count
          ,COUNT(*) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED'))::int AS reliability_sample_count
       FROM tradigo_sessions s
       LEFT JOIN LATERAL (
         SELECT MIN(e.created_at) AS created_at
         FROM tradigo_session_events e
         WHERE e.session_id = s.id AND e.event_type = 'COACH_ACCEPTED'
       ) accepted ON true
       WHERE s.coach_id = c.id
     ) metrics ON true
     WHERE c.approved = true
       AND NOT EXISTS (
         SELECT 1 FROM tradigo_conduct_reports cr
         WHERE cr.subject_user_id=c.id AND cr.status IN ('OPEN','IN_REVIEW')
       )
       AND COALESCE(c.profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
       AND ($1 = '' OR LOWER(c.display_name || ' ' || c.headline || ' ' || c.bio) LIKE '%' || $1 || '%')
       AND ($2 = '' OR $2 = ANY(c.markets))
       AND ($3 = '' OR $3 = ANY(c.specialties))
       AND ($4 = '' OR c.currency = $4)
     ORDER BY ${orderBy}`,
     [query, market, specialty, currency, viewerId],
  );
  const items = result.rows.map(toCoachDto);
  res.json({ items, total: items.length, totalPages: 1 });
});

router.get("/marketplace/coaches/me", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  await ensureDemoCatalog();
  const result = await pool.query("SELECT * FROM tradigo_coaches WHERE id = $1", [actor.id]);
  if (!result.rows[0]) {
    res.status(404).json({ error: { message: "Coach profile not found." } });
    return;
  }
  res.json({ ...toCoachDto(result.rows[0]), applicationStatus: "APPROVED" });
});

router.put("/marketplace/coaches/me", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const headline = typeof req.body?.headline === "string" ? req.body.headline.trim() : null;
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim() : null;
  const teachingMethod = typeof req.body?.teachingMethod === "string" ? req.body.teachingMethod.trim() : null;
  const coachingBoundaries = typeof req.body?.coachingBoundaries === "string" ? req.body.coachingBoundaries.trim() : null;
  const hourlyRateCents = Number.isInteger(req.body?.hourlyRateCents) ? req.body.hourlyRateCents : null;
  const prohibited = /\b(guaranteed?|guarantee|signals?|copy\s*trading|profit|returns?|execution|broker|vip|subscription)\b/i;
  if ([headline, bio, teachingMethod, coachingBoundaries].some((value) => value && prohibited.test(value))) {
    res.status(400).json({ error: { message: "Profile copy must describe education without guarantees, signals, returns, broker execution, or VIP/subscription claims." } });
    return;
  }
  if (hourlyRateCents !== null && hourlyRateCents < 0) {
    res.status(400).json({ error: { message: "The hourly rate cannot be negative." } });
    return;
  }
  await pool.query(
    `UPDATE tradigo_coaches
     SET pending_headline = COALESCE($1, pending_headline),
         pending_bio = COALESCE($2, pending_bio),
         pending_teaching_method = COALESCE($3, pending_teaching_method),
         pending_coaching_boundaries = COALESCE($4, pending_coaching_boundaries),
         hourly_rate_cents = COALESCE($5, hourly_rate_cents),
         profile_change_status = 'PENDING_REVIEW', updated_at = NOW()
     WHERE id = $6`,
    [headline, bio, teachingMethod, coachingBoundaries, hourlyRateCents, actor.id],
  );
  res.json({ success: true, status: "PENDING_REVIEW" });
});

router.patch("/admin/coaches/:id/profile-review", async (req, res): Promise<void> => {
  if (!await requireModerator(req)) {
    res.status(403).json({ error: { message: "Administrator authentication is required." } });
    return;
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const approved = req.body?.approved === true;
  const result = await pool.query(
    `UPDATE tradigo_coaches
     SET headline=CASE WHEN $1 THEN COALESCE(pending_headline, headline) ELSE headline END,
         bio=CASE WHEN $1 THEN COALESCE(pending_bio, bio) ELSE bio END,
         teaching_method=CASE WHEN $1 THEN COALESCE(pending_teaching_method, teaching_method) ELSE teaching_method END,
         coaching_boundaries=CASE WHEN $1 THEN COALESCE(pending_coaching_boundaries, coaching_boundaries) ELSE coaching_boundaries END,
         pending_headline=NULL, pending_bio=NULL, pending_teaching_method=NULL, pending_coaching_boundaries=NULL,
         profile_change_status=CASE WHEN $1 THEN 'CURRENT' ELSE 'CHANGES_DECLINED' END,
         updated_at=NOW()
     WHERE id=$2
     RETURNING *`,
    [approved, id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: { message: "Coach not found." } });
    return;
  }
  res.json({ coach: toCoachDto(result.rows[0]), reviewStatus: approved ? "APPROVED" : "DECLINED" });
});

router.get("/marketplace/coaches/:id/availability", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const availability = await getAvailability(id);
  if (!availability) {
    res.status(404).json({ error: { message: "Coach availability was not found." } });
    return;
  }
  const duration = Number(req.query.durationMinutes ?? 25);
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date();
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date(Date.now() + 14 * 86_400_000);
  const slots = [10, 25, 50].includes(duration) && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())
    ? await availableSlots(id, duration, from, to)
    : [];
  res.json({ availability, slots });
});

router.get("/marketplace/coaches/me/availability", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const availability = await getAvailability(actor.id);
  res.json({ availability });
});

router.put("/marketplace/coaches/me/availability", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const timezone = typeof req.body?.timezone === "string" ? req.body.timezone.trim() : "";
  const minNoticeMinutes = Number(req.body?.minNoticeMinutes);
  const bookingHorizonDays = Number(req.body?.bookingHorizonDays);
  const bufferMinutes = Number(req.body?.bufferMinutes);
  const rules = Array.isArray(req.body?.rules) ? req.body.rules : [];
  const exceptions = Array.isArray(req.body?.exceptions) ? req.body.exceptions : [];
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    res.status(400).json({ error: { code: "INVALID_TIMEZONE", message: "Choose a valid IANA timezone." } });
    return;
  }
  const normalizedRules: AvailabilityRule[] = rules.map((rule: any) => ({
    weekday: Number(rule.weekday),
    startMinute: Number(rule.startMinute),
    endMinute: Number(rule.endMinute),
    timezone,
  })).filter((rule: AvailabilityRule) =>
    Number.isInteger(rule.weekday) && rule.weekday >= 0 && rule.weekday <= 6
    && Number.isInteger(rule.startMinute) && Number.isInteger(rule.endMinute)
    && rule.startMinute >= 0 && rule.endMinute <= 1440 && rule.endMinute > rule.startMinute,
  );
  const normalizedExceptions: AvailabilityException[] = exceptions.map((exception: any) => ({
    startsAt: String(exception.startsAt || ""),
    endsAt: String(exception.endsAt || ""),
    kind: "BLACKOUT",
    note: typeof exception.note === "string" ? exception.note.trim().slice(0, 240) : undefined,
  })).filter((exception: AvailabilityException) => {
    const start = new Date(exception.startsAt).getTime();
    const end = new Date(exception.endsAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });
  if (!Number.isInteger(minNoticeMinutes) || minNoticeMinutes < 0 || minNoticeMinutes > 30 * 24 * 60
    || !Number.isInteger(bookingHorizonDays) || bookingHorizonDays < 1 || bookingHorizonDays > 365
    || !Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 180
    || normalizedRules.length !== rules.length) {
    res.status(400).json({ error: { code: "INVALID_AVAILABILITY", message: "Availability rules and booking limits are invalid." } });
    return;
  }
  await ensureSchedulingSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT id FROM tradigo_coaches WHERE id=$1 FOR UPDATE", [actor.id]);
    await client.query(
      `UPDATE tradigo_coaches
       SET availability_timezone=$1, availability_min_notice_minutes=$2,
           availability_booking_horizon_days=$3, availability_buffer_minutes=$4, updated_at=NOW()
       WHERE id=$5`,
      [timezone, minNoticeMinutes, bookingHorizonDays, bufferMinutes, actor.id],
    );
    await client.query("DELETE FROM tradigo_coach_availability_rules WHERE coach_id=$1", [actor.id]);
    for (const rule of normalizedRules) {
      await client.query(
        `INSERT INTO tradigo_coach_availability_rules (id,coach_id,weekday,start_minute,end_minute,timezone)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), actor.id, rule.weekday, rule.startMinute, rule.endMinute, timezone],
      );
    }
    await client.query("DELETE FROM tradigo_coach_availability_exceptions WHERE coach_id=$1", [actor.id]);
    for (const exception of normalizedExceptions) {
      await client.query(
        `INSERT INTO tradigo_coach_availability_exceptions (id,coach_id,starts_at,ends_at,kind,note)
         VALUES ($1,$2,$3::timestamptz,$4::timestamptz,'BLACKOUT',$5)`,
        [randomUUID(), actor.id, exception.startsAt, exception.endsAt, exception.note ?? null],
      );
    }
    await client.query("COMMIT");
    res.json({ availability: await getAvailability(actor.id) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "Availability could not be saved." } });
  } finally {
    client.release();
  }
});

router.get("/marketplace/coaches/:id", async (req, res): Promise<void> => {
  await ensureIdentitySchema();
  await ensureDemoCatalog();
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const viewer = await getApplicationIdentity(req);
  const viewerId = viewer?.role === "TRADER" ? viewer.id : "";
  const result = await pool.query(
    `SELECT c.*,
       COUNT(s.id) FILTER (WHERE s.status = 'COMPLETED')::int AS completed_session_count,
        CASE WHEN COUNT(s.id) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED')) > 0
          THEN ROUND(100.0 * COUNT(s.id) FILTER (WHERE s.status = 'COMPLETED') / COUNT(s.id) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED')), 0)
          ELSE NULL END AS session_reliability_percent,
        COUNT(s.id) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED'))::int AS reliability_sample_count,
         COUNT(s.id) FILTER (WHERE s.status IN ('COMPLETED','CANCELLED'))::int AS response_sample_count,
         EXISTS (
           SELECT 1 FROM tradigo_favorites f
           WHERE f.trader_id = $2 AND f.coach_id = c.id
         ) AS is_favorited
     FROM tradigo_coaches c
     LEFT JOIN tradigo_sessions s ON s.coach_id = c.id
     WHERE c.id = $1 AND c.approved = true
     GROUP BY c.id`,
     [id, viewerId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: "Coach profile not found or not approved." });
    return;
  }
  res.json(toCoachDto(result.rows[0]));
});

router.get("/marketplace/favorites", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureIdentitySchema();
  const result = await pool.query(
    `SELECT f.coach_id, f.created_at
     FROM tradigo_favorites f
     JOIN tradigo_coaches c ON c.id=f.coach_id
     WHERE f.trader_id=$1 AND c.approved=true
     ORDER BY f.created_at DESC`,
    [actor.id],
  );
  res.json({ favorites: result.rows.map((row) => ({ coachUserId: row.coach_id, coachProfileId: row.coach_id, createdAt: row.created_at })) });
});

router.post("/marketplace/coaches/:id/favorite", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  const coachId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await ensureIdentitySchema();
  const coach = await pool.query("SELECT id FROM tradigo_coaches WHERE id=$1 AND approved=true", [coachId]);
  if (!coach.rowCount) {
    res.status(404).json({ error: { message: "Coach not found or not approved." } });
    return;
  }
  await pool.query("INSERT INTO tradigo_favorites (trader_id, coach_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [actor.id, coachId]);
  res.status(201).json({ favorited: true, coachId });
});

router.delete("/marketplace/coaches/:id/favorite", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  const coachId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await ensureIdentitySchema();
  await pool.query("DELETE FROM tradigo_favorites WHERE trader_id=$1 AND coach_id=$2", [actor.id, coachId]);
  res.json({ favorited: false, coachId });
});

router.put("/traders/onboarding/draft", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureIdentitySchema();
  const currentStep = Number(req.body?.currentStep);
  const experienceLevel = typeof req.body?.experienceLevel === "string" ? req.body.experienceLevel : "BEGINNER";
  const timezone = typeof req.body?.timezone === "string" ? req.body.timezone.trim().slice(0, 80) : null;
  const instruments = Array.isArray(req.body?.instruments)
    ? req.body.instruments.filter((value: unknown): value is string => typeof value === "string").slice(0, 20)
    : [];
  await pool.query(
    `INSERT INTO tradigo_trader_profiles
       (user_id, experience_level, instruments, preferred_markets, timezone, onboarding_current_step, updated_at)
     VALUES ($1,$2,$3,$3,$4,$5,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       experience_level=EXCLUDED.experience_level,
       instruments=EXCLUDED.instruments,
       preferred_markets=EXCLUDED.preferred_markets,
       timezone=EXCLUDED.timezone,
       onboarding_current_step=GREATEST(tradigo_trader_profiles.onboarding_current_step, EXCLUDED.onboarding_current_step),
       updated_at=NOW()`,
    [actor.id, experienceLevel, instruments, timezone, Number.isInteger(currentStep) ? Math.min(7, Math.max(1, currentStep)) : 1],
  );
  res.json({ profile: toTraderProfileDto((await pool.query("SELECT * FROM tradigo_trader_profiles WHERE user_id=$1", [actor.id])).rows[0], actor.id) });
});

router.post("/traders/onboarding", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureIdentitySchema();
  const experienceLevel = typeof req.body?.experienceLevel === "string" ? req.body.experienceLevel : "BEGINNER";
  const timezone = typeof req.body?.timezone === "string" ? req.body.timezone.trim().slice(0, 80) : null;
  const instruments = Array.isArray(req.body?.instruments)
    ? req.body.instruments.filter((value: unknown): value is string => typeof value === "string").slice(0, 20)
    : [];
  if (!["BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"].includes(experienceLevel) || instruments.length === 0) {
    res.status(400).json({ error: { message: "Choose an experience level and at least one market." } });
    return;
  }
  await pool.query(
    `INSERT INTO tradigo_trader_profiles
       (user_id, experience_level, instruments, preferred_markets, timezone, onboarding_current_step, onboarding_completed_at, updated_at)
     VALUES ($1,$2,$3,$3,$4,7,NOW(),NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       experience_level=EXCLUDED.experience_level,
       instruments=EXCLUDED.instruments,
       preferred_markets=EXCLUDED.preferred_markets,
       timezone=EXCLUDED.timezone,
       onboarding_current_step=7,
       onboarding_completed_at=NOW(),
       updated_at=NOW()`,
    [actor.id, experienceLevel, instruments, timezone],
  );
  res.json({ profile: toTraderProfileDto((await pool.query("SELECT * FROM tradigo_trader_profiles WHERE user_id=$1", [actor.id])).rows[0], actor.id) });
});

router.get("/coaches/me/presence", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  await ensureDemoCatalog();
  const result = await pool.query("SELECT availability FROM tradigo_coaches WHERE id = $1", [actor.id]);
  res.json({ status: result.rows[0]?.availability ?? "OFFLINE", leaseId: `lease-${actor.id}` });
});

router.post("/coaches/me/presence", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  if (!["AVAILABLE", "AWAY", "OFFLINE"].includes(status)) {
    res.status(400).json({ error: { message: "Choose Available, Away, or Offline." } });
    return;
  }
  await pool.query("UPDATE tradigo_coaches SET availability = $1, updated_at = NOW() WHERE id = $2", [status, actor.id]);
  res.json({ status, leaseId: status === "OFFLINE" ? null : `lease-${actor.id}` });
});

router.post("/coaches/me/presence/heartbeat", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  res.json({ success: true });
});

router.get("/notifications", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor) { res.status(401).json({ error: { message: "Sign in is required." } }); return; }
  await ensureIdentitySchema();
  const result = await pool.query(
    `SELECT e.id, e.event_type, e.details, e.created_at, e.session_id, ns.read_at, ns.archived_at
     FROM tradigo_session_events e JOIN tradigo_sessions s ON s.id=e.session_id
      LEFT JOIN tradigo_notification_states ns ON ns.user_id=$1 AND ns.event_id=e.id
     WHERE (e.recipient_id=$1 OR (e.recipient_id IS NULL AND (s.trader_id=$1 OR s.coach_id=$1))) AND e.actor_id <> $1
       AND ns.archived_at IS NULL
     ORDER BY e.created_at DESC LIMIT 30`, [actor.id],
  );
  const notifications = [
    ...result.rows.map((row) => ({
      id: `event-${row.id}`,
      type: row.event_type,
      title: notificationTitle(String(row.event_type)),
      sessionId: row.session_id,
      details: notificationDetails(String(row.event_type), row.details as Record<string, unknown> | null, String(row.session_id)),
      body: notificationBody(String(row.event_type), row.details as Record<string, unknown> | null, String(row.session_id)),
      actionPath: notificationActionPath(String(row.event_type), String(row.session_id), actor.role),
      createdAt: row.created_at,
      read: Boolean(row.read_at),
      readAt: row.read_at,
    })),
    ...await applicationClarificationNotifications(actor),
  ].sort((left, right) => new Date(String(right.createdAt)).getTime() - new Date(String(left.createdAt)).getTime()).slice(0, 30);
  res.json({ notifications });
});

router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor) { res.status(401).json({ error: { message: "Sign in is required." } }); return; }
  await ensureIdentitySchema();
  const result = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE ns.read_at IS NULL AND ns.archived_at IS NULL)::int AS unread_count
     FROM tradigo_session_events e
     JOIN tradigo_sessions s ON s.id=e.session_id
     LEFT JOIN tradigo_notification_states ns ON ns.user_id=$1 AND ns.event_id=e.id
     WHERE (e.recipient_id=$1 OR (e.recipient_id IS NULL AND (s.trader_id=$1 OR s.coach_id=$1))) AND e.actor_id <> $1`,
    [actor.id],
  );
  let unreadCount = Number(result.rows[0]?.unread_count ?? 0);
  if (actor.role === "ADMIN" || actor.role === "MODERATOR") {
    const tableResult = await pool.query("SELECT to_regclass('public.tradigo_application_clarifications') AS table_name");
    if (tableResult.rows[0]?.table_name) {
      const clarificationResult = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE ns.read_at IS NULL AND ns.archived_at IS NULL)::int AS unread_count
         FROM tradigo_application_clarifications c
         LEFT JOIN tradigo_application_notification_states ns
           ON ns.user_id=$1 AND ns.clarification_id=c.id
         WHERE c.status='SUBMITTED'`,
        [actor.id],
      );
      unreadCount += Number(clarificationResult.rows[0]?.unread_count ?? 0);
    }
  }
  res.json({ unreadCount, count: unreadCount });
});

function notificationEventId(value: string): number | null {
  const match = /^event-(\d+)$/.exec(value);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const notificationId = String(req.params.id);
  const eventId = notificationEventId(notificationId);
  const clarificationId = applicationNotificationId(notificationId);
  if (!actor || (eventId === null && clarificationId === null)) {
    res.status(404).json({ error: { message: "Notification not found." } });
    return;
  }
  await ensureIdentitySchema();
  if (clarificationId) {
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    const tableResult = await pool.query("SELECT to_regclass('public.tradigo_application_clarifications') AS table_name");
    if (!tableResult.rows[0]?.table_name) {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    const clarification = await pool.query(
      `SELECT id FROM tradigo_application_clarifications
       WHERE id=$1 AND status='SUBMITTED'`,
      [clarificationId],
    );
    if (!clarification.rowCount) {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    await pool.query(
      `INSERT INTO tradigo_application_notification_states (user_id,clarification_id,read_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id,clarification_id) DO UPDATE SET read_at=COALESCE(tradigo_application_notification_states.read_at,NOW())`,
      [actor.id, clarificationId],
    );
    res.json({ success: true, readAt: new Date().toISOString() });
    return;
  }
  const event = await pool.query(
    `SELECT e.id FROM tradigo_session_events e
     JOIN tradigo_sessions s ON s.id=e.session_id
     WHERE e.id=$1 AND (e.recipient_id=$2 OR (e.recipient_id IS NULL AND (s.trader_id=$2 OR s.coach_id=$2))) AND e.actor_id <> $2`,
    [eventId, actor.id],
  );
  if (!event.rowCount) { res.status(404).json({ error: { message: "Notification not found." } }); return; }
  await pool.query(
    `INSERT INTO tradigo_notification_states (user_id,event_id,read_at)
     VALUES ($1,$2,NOW())
     ON CONFLICT (user_id,event_id) DO UPDATE SET read_at=COALESCE(tradigo_notification_states.read_at,NOW())`,
    [actor.id, eventId],
  );
  res.json({ success: true, readAt: new Date().toISOString() });
});

router.post("/notifications/read-all", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor) { res.status(401).json({ error: { message: "Sign in is required." } }); return; }
  await ensureIdentitySchema();
  await pool.query(
    `INSERT INTO tradigo_notification_states (user_id,event_id,read_at)
     SELECT $1,e.id,NOW()
     FROM tradigo_session_events e
     JOIN tradigo_sessions s ON s.id=e.session_id
     LEFT JOIN tradigo_notification_states ns ON ns.user_id=$1 AND ns.event_id=e.id
     WHERE (e.recipient_id=$1 OR (e.recipient_id IS NULL AND (s.trader_id=$1 OR s.coach_id=$1))) AND e.actor_id <> $1 AND ns.read_at IS NULL AND ns.archived_at IS NULL
     ON CONFLICT (user_id,event_id) DO UPDATE SET read_at=COALESCE(tradigo_notification_states.read_at,NOW())`,
    [actor.id],
  );
  if (actor.role === "ADMIN" || actor.role === "MODERATOR") {
    const tableResult = await pool.query("SELECT to_regclass('public.tradigo_application_clarifications') AS table_name");
    if (tableResult.rows[0]?.table_name) {
      await pool.query(
        `INSERT INTO tradigo_application_notification_states (user_id,clarification_id,read_at)
         SELECT $1,c.id,NOW()
         FROM tradigo_application_clarifications c
         LEFT JOIN tradigo_application_notification_states ns
           ON ns.user_id=$1 AND ns.clarification_id=c.id
         WHERE c.status='SUBMITTED' AND ns.read_at IS NULL AND ns.archived_at IS NULL
         ON CONFLICT (user_id,clarification_id) DO UPDATE SET read_at=COALESCE(tradigo_application_notification_states.read_at,NOW())`,
        [actor.id],
      );
    }
  }
  res.json({ success: true });
});

router.post("/notifications/:id/archive", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const notificationId = String(req.params.id);
  const eventId = notificationEventId(notificationId);
  const clarificationId = applicationNotificationId(notificationId);
  if (!actor || (eventId === null && clarificationId === null)) {
    res.status(404).json({ error: { message: "Notification not found." } });
    return;
  }
  await ensureIdentitySchema();
  if (clarificationId) {
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    const tableResult = await pool.query("SELECT to_regclass('public.tradigo_application_clarifications') AS table_name");
    if (!tableResult.rows[0]?.table_name) {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    const clarification = await pool.query(
      `SELECT id FROM tradigo_application_clarifications
       WHERE id=$1 AND status='SUBMITTED'`,
      [clarificationId],
    );
    if (!clarification.rowCount) {
      res.status(404).json({ error: { message: "Notification not found." } });
      return;
    }
    await pool.query(
      `INSERT INTO tradigo_application_notification_states (user_id,clarification_id,archived_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id,clarification_id) DO UPDATE SET archived_at=NOW()`,
      [actor.id, clarificationId],
    );
    res.json({ success: true });
    return;
  }
  const event = await pool.query(
    `SELECT e.id FROM tradigo_session_events e
     JOIN tradigo_sessions s ON s.id=e.session_id
     WHERE e.id=$1 AND (e.recipient_id=$2 OR (e.recipient_id IS NULL AND (s.trader_id=$2 OR s.coach_id=$2))) AND e.actor_id <> $2`,
    [eventId, actor.id],
  );
  if (!event.rowCount) { res.status(404).json({ error: { message: "Notification not found." } }); return; }
  await pool.query(
    `INSERT INTO tradigo_notification_states (user_id,event_id,archived_at)
     VALUES ($1,$2,NOW())
     ON CONFLICT (user_id,event_id) DO UPDATE SET archived_at=NOW()`,
    [actor.id, eventId],
  );
  res.json({ success: true });
});

router.get("/coach-now/requests/current", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.json({ request: null, session: null });
    return;
  }
  const result = await pool.query(
    "SELECT * FROM tradigo_sessions WHERE trader_id = $1 AND status NOT IN ('COMPLETED','CANCELLED') ORDER BY created_at DESC LIMIT 1",
    [actor.id],
  );
  const session = result.rows[0] as Record<string, unknown> | undefined;
  if (!session) {
    res.json({ request: null, session: null });
    return;
  }
  res.json({
    request: { status: session.status, instrument: "FOREX", specialty: session.mode === "SCHEDULED" ? "Scheduled session" : "Coach Now" },
    session: toSessionDto(session),
  });
});

router.post("/coach-now/requests/current/cancel", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  const result = await pool.query(
    "SELECT * FROM tradigo_sessions WHERE trader_id=$1 AND status IN ('REQUESTED','PAYMENT_READY') ORDER BY created_at DESC LIMIT 1",
    [actor.id],
  );
  const session = result.rows[0] as Record<string, any> | undefined;
  if (!session) {
    res.json({ success: true, idempotent: true, session: null });
    return;
  }
  try {
    const cancellation = await cancelSessionSafely(session, actor.id, "Trader cancelled the pending consultation request.");
    res.json({ success: true, idempotent: !cancellation.cancelled, session: toSessionDto((await findSession(String(session.id)))!) });
  } catch (error) {
    res.status(502).json({ error: { message: error instanceof Error ? error.message : "The request could not be cancelled safely." } });
  }
});

router.get("/coach-now/match/:matchGroupId", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  res.json(await matchGroupView(actor.id, matchGroupId));
});

router.post("/coach-now/match/:matchGroupId/rematch", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureSchedulingSchema();
  try {
    const rematch = await rematchCoachNowClaim(actor.id, matchGroupId);
    if (rematch.status === "NOT_FOUND") {
      res.status(404).json({ error: { message: "Live match route not found." } });
      return;
    }
    if (rematch.status === "NOT_EXPIRED") {
      res.status(409).json({ error: { code: "COACH_CLAIM_NOT_EXPIRED", message: "There is no expired coach claim to rematch." } });
      return;
    }
    const view = await matchGroupView(actor.id, matchGroupId);
    const terminal = rematch.status === "TERMINAL";
    res.json({
      ...view,
      claimExpired: rematch.expired || view.claimExpired,
      rematchAvailable: terminal ? false : view.rematchAvailable,
      ...(terminal && view.state === "NO_LIVE_MATCH" ? {
        fallback: {
          nextAction: "BOOK_SCHEDULED",
          message: Number(view.rematchAttempts ?? 0) >= COACH_NOW_MAX_REMATCH_ATTEMPTS
            ? "We could not connect you with a live coach after the maximum number of attempts. You can book the next available scheduled session or request an availability alert."
            : "No other eligible coach is available for this live route right now. You can book a scheduled session or request an availability alert.",
        },
      } : {}),
    });
  } catch (error) {
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The live route could not be rematched safely." } });
  }
});

router.post("/coach-now/match/:matchGroupId/confirm", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureSchedulingSchema();
  const client = await pool.connect();
  let sessionId: string | null = null;
  let replayed = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${matchGroupId}`]);
    const result = await client.query(
      "SELECT * FROM tradigo_sessions WHERE trader_id=$1 AND match_group_id=$2 ORDER BY created_at ASC FOR UPDATE",
      [actor.id, matchGroupId],
    );
    const rows = result.rows as Record<string, any>[];
    const ready = rows.find((row) => ["PAYMENT_READY", "ROOM_READY", "ACTIVE"].includes(String(row.status)));
    if (ready) {
      sessionId = String(ready.id);
      await client.query("COMMIT");
      replayed = true;
    } else {
      const claimed = rows.find((row) => String(row.status) === "COACH_CLAIMED");
      if (!claimed) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { code: "COACH_CLAIM_NOT_AVAILABLE", message: "This coach claim is no longer available. Tradigo can search again for another live coach." } });
        return;
      }
      if (claimed.coach_claim_expires_at && new Date(String(claimed.coach_claim_expires_at)).getTime() <= Date.now()) {
        await client.query(
          `UPDATE tradigo_sessions
           SET status='CANCELLED', payment_status='CANCELLED',
               cancellation_reason='The coach claim expired before the trader confirmed.',
               cancelled_at=NOW(), cancelled_by='system:coach-now-claim-expiry', updated_at=NOW()
           WHERE id=$1`,
          [claimed.id],
        );
        await client.query("COMMIT");
        await appendEvent(String(claimed.id), "system:coach-now-claim-expiry", "COACH_CLAIM_EXPIRED", { matchGroupId });
        res.status(409).json({ error: { code: "COACH_CLAIM_EXPIRED", message: "That coach claim expired before confirmation. We can search again for another eligible coach." } });
        return;
      }
      const paypal = await createPayPalOrder(Number(claimed.amount_cents), String(claimed.id), String(claimed.currency));
      if (paypalConfigured() && !paypal.connected) {
        await client.query("ROLLBACK");
        await recordPaymentSetupRetry(String(claimed.id), actor.id).catch(() => undefined);
        res.status(502).json({
          error: {
            code: PAYMENT_SETUP_RETRY_EVENT,
            retryable: true,
            message: "PayPal could not create the authorization order. The coach claim is still reserved; please try again shortly.",
          },
        });
        return;
      }
      sessionId = String(claimed.id);
      await client.query(
        `UPDATE tradigo_sessions
         SET status='PAYMENT_READY', payment_status=$1, paypal_order_id=$2, payment_approval_url=$3,
             coach_claim_expires_at=NULL, trader_confirmed_at=NOW(), updated_at=NOW()
         WHERE id=$4 AND status='COACH_CLAIMED'`,
        [paypal.connected ? "PAYPAL_ORDER_CREATED" : "SANDBOX_TEST_AUTHORIZATION", paypal.orderId ?? null, paypal.approvalUrl ?? null, claimed.id],
      );
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The coach confirmation could not be completed safely." } });
    return;
  } finally {
    client.release();
  }
  if (sessionId && !replayed) await appendEvent(sessionId, actor.id, "TRADER_CONFIRMED_COACH", { matchGroupId });
  res.json({ ...(await matchGroupView(actor.id, matchGroupId)), ...(replayed ? { idempotent: true } : {}) });
});

router.post("/coach-now/match/:matchGroupId/decline", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureSchedulingSchema();
  const client = await pool.connect();
  let declinedSessionId: string | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${matchGroupId}`]);
    const result = await client.query(
      "SELECT * FROM tradigo_sessions WHERE trader_id=$1 AND match_group_id=$2 ORDER BY created_at ASC FOR UPDATE",
      [actor.id, matchGroupId],
    );
    const claimed = (result.rows as Record<string, any>[]).find((row) => String(row.status) === "COACH_CLAIMED");
    if (!claimed) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { code: "COACH_CLAIM_NOT_AVAILABLE", message: "There is no active coach claim to decline." } });
      return;
    }
    declinedSessionId = String(claimed.id);
    await client.query(
      `UPDATE tradigo_sessions
       SET status='CANCELLED', payment_status='CANCELLED',
           cancellation_reason='The trader chose to find another coach.',
           trader_declined_at=NOW(), cancelled_at=NOW(), cancelled_by=$1, updated_at=NOW()
       WHERE id=$2 AND status='COACH_CLAIMED'`,
      [actor.id, claimed.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The coach claim could not be declined safely." } });
    return;
  } finally {
    client.release();
  }
  if (declinedSessionId) await appendEvent(declinedSessionId, actor.id, "TRADER_DECLINED_COACH", {
    matchGroupId,
    failureClass: "TRADER_DECLINE",
    cancellationReasonCode: "TRADER_DECLINED_COACH",
  });
  res.json({ ...(await matchGroupView(actor.id, matchGroupId)), rematchAvailable: true });
});

router.post("/coach-now/availability-alert", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureIdentitySchema();
  await ensureSchedulingSchema();
  const instrumentClass = typeof req.body?.instrumentClass === "string" ? req.body.instrumentClass.trim().toUpperCase() : "GENERAL";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim().toUpperCase() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const maxRateCents = Number(req.body?.maxRateCents ?? 0);
  if (!["GENERAL", "FOREX", "INDICES", "CRYPTO", "EQUITIES", "COMMODITIES"].includes(instrumentClass) || maxRateCents < 0 || maxRateCents > 100000) {
    res.status(400).json({ error: { message: "Choose a valid learning route for the availability alert." } });
    return;
  }
  const result = await pool.query(
    `INSERT INTO tradigo_coach_now_availability_alerts
      (id,trader_id,instrument_class,topic,language,max_rate_cents,notified_at)
     VALUES ($1,$2,$3,$4,$5,$6,NULL)
     ON CONFLICT (trader_id,instrument_class,topic,language)
     DO UPDATE SET max_rate_cents=EXCLUDED.max_rate_cents, created_at=NOW(), notified_at=NULL
     RETURNING created_at`,
    [randomUUID(), actor.id, instrumentClass, topic, language, maxRateCents],
  );
  await recordMarketplaceEvent(pool, {
    eventType: "COACH_NOW_AVAILABILITY_ALERT_REQUESTED",
    actorId: actor.id,
    details: { instrumentClass, topic, language, maxRateCents },
    eventKey: `coach-now-alert:${actor.id}:${instrumentClass}:${topic}:${language}`,
  });
  res.status(201).json({ requested: true, createdAt: result.rows[0]?.created_at ?? new Date().toISOString() });
});

router.post("/coach-now/match/:matchGroupId/expand", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  await ensureIdentitySchema();
  await ensureSchedulingSchema();
  const existingResult = await pool.query(
    `SELECT * FROM tradigo_sessions
     WHERE trader_id=$1 AND match_group_id=$2
     ORDER BY created_at ASC`,
    [actor.id, matchGroupId],
  );
  const existing = existingResult.rows as Record<string, any>[];
  if (!existing.length) {
    res.status(404).json({ error: { message: "Live match route not found." } });
    return;
  }
  if (existing.some((session) => session.status !== "REQUESTED") || existing.length >= 5) {
    res.json(await matchGroupView(actor.id, matchGroupId));
    return;
  }
  const excludedCoachIds = existing.map((session) => String(session.coach_id));
  const candidatesResult = await pool.query(
    `SELECT c.*,
       COALESCE(metrics.completed_session_count, 0) AS completed_session_count,
       metrics.average_response_minutes, metrics.response_sample_count,
       EXISTS (
         SELECT 1 FROM tradigo_sessions prior
         WHERE prior.trader_id=$1 AND prior.coach_id=c.id AND prior.status='COMPLETED'
       ) AS has_repeat_relationship
     FROM tradigo_coaches c
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE s.status='COMPLETED')::int AS completed_session_count,
              CASE WHEN COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL) > 0
                THEN ROUND(AVG(EXTRACT(EPOCH FROM (accepted.created_at - s.created_at)) / 60)
                  FILTER (WHERE accepted.created_at IS NOT NULL), 0)
                ELSE NULL END AS average_response_minutes,
              COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL)::int AS response_sample_count
       FROM tradigo_sessions s
       LEFT JOIN LATERAL (
         SELECT MIN(e.created_at) AS created_at
         FROM tradigo_session_events e
         WHERE e.session_id=s.id AND e.event_type='COACH_ACCEPTED'
       ) accepted ON true
       WHERE s.coach_id=c.id
     ) metrics ON true
     WHERE c.approved=true AND c.availability='AVAILABLE'
       AND NOT EXISTS (
         SELECT 1 FROM tradigo_conduct_reports cr
         WHERE cr.subject_user_id=c.id AND cr.status IN ('OPEN','IN_REVIEW')
       )
       AND COALESCE(c.profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
       AND NOT (c.id = ANY($2::text[]))`,
    [actor.id, excludedCoachIds],
  );
  const base = existing[0];
  const capPerMinute = Math.floor(Number(base.authorized_amount_cents) / Math.max(1, Number(base.duration_minutes)));
  const selected = candidatesResult.rows
    .map((row) => ({ row, ...scoreCoachForMatch(row, {
      instrumentClass: String(base.instrument_class || "GENERAL"),
      topic: String(base.topic || ""),
      language: "",
      maxRateCents: capPerMinute,
      traderId: actor.id,
    }) }))
    .filter((candidate) => candidate.isEligible)
    .sort((left, right) => right.scoreBreakdown.totalScore - left.scoreBreakdown.totalScore)
    .slice(0, 2);
  if (!selected.length) {
    res.json({ ...(await matchGroupView(actor.id, matchGroupId)), expansion: "NO_ADDITIONAL_MATCHES" });
    return;
  }

  const client = await pool.connect();
  const createdSessionIds: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${matchGroupId}`]);
    const lockedExisting = await client.query(
      "SELECT 1 FROM tradigo_sessions WHERE trader_id=$1 AND match_group_id=$2 LIMIT 1",
      [actor.id, matchGroupId],
    );
    if (lockedExisting.rowCount) {
      await client.query("COMMIT");
      res.json(await matchGroupView(actor.id, matchGroupId));
      return;
    }
    for (const candidate of selected) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${candidate.row.id}`]);
      const coachResult = await client.query(
        `SELECT * FROM tradigo_coaches
         WHERE id=$1 AND approved=true AND availability='AVAILABLE'
           AND COALESCE(profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
           AND NOT EXISTS (
             SELECT 1 FROM tradigo_conduct_reports cr
             WHERE cr.subject_user_id=tradigo_coaches.id AND cr.status IN ('OPEN','IN_REVIEW')
           )
         FOR UPDATE`,
        [candidate.row.id],
      );
      const coach = coachResult.rows[0] as Record<string, any> | undefined;
      if (!coach) continue;
      const policy = await evaluateCoachingPolicy(client, {
        traderId: actor.id,
        coachId: String(coach.id),
        category: "GENERAL_EDUCATION",
        instrumentClass: String(base.instrument_class || "GENERAL"),
        topic: String(base.topic || ""),
        agenda: String(base.agenda || ""),
        learningGoal: "",
      });
      if (policy.decision === "DENIED") continue;
      const sessionId = `sess_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
      const rateCents = Number(coach.instant_rate_per_minute_cents);
      await client.query(
        `INSERT INTO tradigo_sessions
          (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,authorized_amount_cents,
           rate_snapshot_cents,currency,symbol,agenda,topic,coaching_category,instrument_class,payment_status,
           room_name,match_group_id,booking_idempotency_key)
         VALUES ($1,$2,$3,'INSTANT','REQUESTED',$4,$5,$5,$6,$7,$8,$9,$10,'GENERAL_EDUCATION',$11,'NOT_STARTED',$12,$13,$14)`,
        [
          sessionId, actor.id, coach.id, base.duration_minutes, rateCents * Number(base.duration_minutes), rateCents,
          coach.currency, base.symbol ?? null, base.agenda, base.topic, base.instrument_class, `tradigo-${sessionId}`, matchGroupId,
          `match:${matchGroupId}:${coach.id}`,
        ],
      );
      await client.query(
        "INSERT INTO tradigo_rate_snapshots (id,session_id,coach_id,rate_cents,currency,policy) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), sessionId, coach.id, rateCents, coach.currency, { mode: "INSTANT", durationMinutes: base.duration_minutes, matchGroupId, expansion: true, feePercent: 15 }],
      );
      await client.query(
        `INSERT INTO tradigo_learning_records (id,session_id,trader_id,coach_id,learning_goal)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id) DO NOTHING`,
        [randomUUID(), sessionId, actor.id, coach.id, base.topic || base.agenda],
      );
      await recordPolicyDecision(client, sessionId, actor.id, policy);
      createdSessionIds.push(sessionId);
    }
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The live search could not expand safely." } });
    return;
  } finally {
    client.release();
  }
  for (const sessionId of createdSessionIds) {
    await appendEvent(sessionId, actor.id, "REQUESTED", { mode: "MATCH_EXPANDED", matchGroupId });
  }
  res.json({ ...(await matchGroupView(actor.id, matchGroupId)), expansion: "ADDITIONAL_MATCHES_CONTACTED" });
});

router.post("/coach-now/match/:matchGroupId/cancel", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const matchGroupId = Array.isArray(req.params.matchGroupId) ? req.params.matchGroupId[0] : req.params.matchGroupId;
  if (!actor || actor.role !== "TRADER" || !matchGroupId) {
    res.status(403).json({ error: { message: "A trader account is required." } });
    return;
  }
  const result = await pool.query(
    `UPDATE tradigo_sessions
     SET status='CANCELLED', payment_status='CANCELLED',
         cancellation_reason='Trader stopped the live coach search.',
         cancelled_at=NOW(), cancelled_by=$1, updated_at=NOW()
     WHERE trader_id=$1 AND match_group_id=$2 AND status='REQUESTED'
     RETURNING id`,
    [actor.id, matchGroupId],
  );
  for (const row of result.rows) {
    await appendEvent(String(row.id), actor.id, "CANCELLED", {
      matchGroupId,
      reason: "TRADER_STOPPED_SEARCH",
      failureClass: "TRADER_CANCELLATION",
      cancellationReasonCode: "TRADER_STOPPED_SEARCH",
    });
  }
  res.json({ success: true, matchGroupId, cancelledCount: result.rowCount ?? 0 });
});

router.post("/coach-now/match", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required to find a coach." } });
    return;
  }
  await ensureIdentitySchema();
  await ensureSchedulingSchema();
  await ensureDemoCatalog();

  const mode = req.body?.mode === "CHOOSE" ? "CHOOSE" : "FAST";
  const instrumentClass = typeof req.body?.instrumentClass === "string" ? req.body.instrumentClass.trim().toUpperCase() : "GENERAL";
  const symbol = typeof req.body?.symbol === "string" ? req.body.symbol.trim().slice(0, 40) : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim().toUpperCase() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "English";
  const experienceLevel = typeof req.body?.experienceLevel === "string" ? req.body.experienceLevel.trim().toUpperCase() : "BEGINNER";
  const requestedTimezoneBucket = typeof req.body?.timezoneBucket === "string" ? req.body.timezoneBucket.trim().toUpperCase() : "UTC";
  const timezoneBucket = ["UTC", "AMERICAS", "EUROPE_AFRICA", "ASIA_PACIFIC", "OTHER"].includes(requestedTimezoneBucket)
    ? requestedTimezoneBucket
    : "UTC";
  const durationMinutes = Number(req.body?.durationMinutes);
  const maxRateCents = Number(req.body?.maxRateCents ?? 0);
  const learningGoal = typeof req.body?.learningGoal === "string" ? req.body.learningGoal.trim().slice(0, 500) : "";
  const agenda = typeof req.body?.agenda === "string" ? req.body.agenda.trim().slice(0, 2000) : "";
  const requestedCoachIds = Array.isArray(req.body?.coachIds)
    ? req.body.coachIds.filter((value: unknown): value is string => typeof value === "string").slice(0, 3)
    : [];
  const rawIdempotencyKey = req.header("idempotency-key")
    ?? (typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined);
  const idempotencyKey = rawIdempotencyKey?.trim() || null;

  if (
    !["GENERAL", "FOREX", "INDICES", "CRYPTO", "EQUITIES", "COMMODITIES"].includes(instrumentClass)
    || ![10, 25, 50].includes(durationMinutes)
    || (maxRateCents < 0 || maxRateCents > 100000)
    || !agenda
    || (mode === "CHOOSE" && requestedCoachIds.length === 0)
    || (idempotencyKey && idempotencyKey.length > 200)
  ) {
    res.status(400).json({ error: { message: "Choose a valid learning focus, session length, agenda, and matching mode." } });
    return;
  }

  const matchGroupId = idempotencyKey
    ? `match_${createHash("sha256").update(`${actor.id}:${idempotencyKey}`).digest("hex").slice(0, 24)}`
    : `match_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const existing = await pool.query(
    "SELECT 1 FROM tradigo_sessions WHERE trader_id=$1 AND match_group_id=$2 LIMIT 1",
    [actor.id, matchGroupId],
  );
  if (existing.rowCount) {
    res.json(await matchGroupView(actor.id, matchGroupId));
    return;
  }

  const candidatesResult = await pool.query(
    `SELECT c.*,
       COALESCE(metrics.completed_session_count, 0) AS completed_session_count,
       metrics.average_response_minutes,
       metrics.response_sample_count,
       EXISTS (
         SELECT 1 FROM tradigo_sessions prior
         WHERE prior.trader_id=$1 AND prior.coach_id=c.id AND prior.status='COMPLETED'
       ) AS has_repeat_relationship
     FROM tradigo_coaches c
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE s.status='COMPLETED')::int AS completed_session_count,
              CASE WHEN COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL) > 0
                THEN ROUND(AVG(EXTRACT(EPOCH FROM (accepted.created_at - s.created_at)) / 60)
                  FILTER (WHERE accepted.created_at IS NOT NULL), 0)
                ELSE NULL END AS average_response_minutes,
              COUNT(*) FILTER (WHERE accepted.created_at IS NOT NULL)::int AS response_sample_count
       FROM tradigo_sessions s
       LEFT JOIN LATERAL (
         SELECT MIN(e.created_at) AS created_at
         FROM tradigo_session_events e
         WHERE e.session_id=s.id AND e.event_type='COACH_ACCEPTED'
       ) accepted ON true
       WHERE s.coach_id=c.id
     ) metrics ON true
     WHERE c.approved=true AND c.availability='AVAILABLE'
       AND NOT EXISTS (
         SELECT 1 FROM tradigo_conduct_reports cr
         WHERE cr.subject_user_id=c.id AND cr.status IN ('OPEN','IN_REVIEW')
       )`,
    [actor.id],
  );
  const scored = candidatesResult.rows
    .map((row) => ({ row, ...scoreCoachForMatch(row, { instrumentClass, topic, language, maxRateCents, traderId: actor.id }) }))
    .filter((candidate) => mode === "FAST" || requestedCoachIds.includes(String(candidate.row.id)))
    .sort((left, right) => right.scoreBreakdown.totalScore - left.scoreBreakdown.totalScore);
  const eligible = scored.filter((candidate) => candidate.isEligible);
  const selected = eligible.slice(0, 3);

  if (!selected.length) {
    await recordMarketplaceEvent(pool, {
      eventType: "MATCH_NO_LIVE_MATCH",
      actorId: actor.id,
      details: {
        ...matchQualityDimensions({ mode, instrumentClass, topic, language, durationMinutes, experienceLevel: String(experienceLevel), timezoneBucket }),
        availableCount: candidatesResult.rowCount ?? 0,
        qualifiedCount: eligible.length,
        failureClass: candidatesResult.rowCount ? "DEMAND_FAILURE" : "SUPPLY_FAILURE",
        reasonCode: candidatesResult.rowCount ? "NO_ELIGIBLE_COACH" : "NO_AVAILABLE_COACH",
        nextAction: "BOOK_SCHEDULED",
      },
      eventKey: `match:${matchGroupId}:no-live-match`,
    });
    res.json({
      matchGroupId: null,
      state: "NO_LIVE_MATCH",
      items: [],
      candidates: scored.slice(0, 8).map((candidate) => ({
        coach: toCoachDto(candidate.row),
        ...candidate.scoreBreakdown,
        matchReasons: candidate.matchReasons,
        isEligible: candidate.isEligible,
        ineligibilityReasons: candidate.ineligibilityReasons,
      })),
      searchStats: {
        availableCount: candidatesResult.rowCount ?? 0,
        qualifiedCount: eligible.length,
        contactedCount: 0,
        expanded: scored.some((candidate) => !candidate.isEligible),
      },
      fallback: { nextAction: "BOOK_SCHEDULED", message: "No live coach matched right now. You can book the next available scheduled session instead." },
    });
    return;
  }

  const client = await pool.connect();
  const createdSessionIds: string[] = [];
  try {
    await client.query("BEGIN");
    for (const candidate of selected) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${candidate.row.id}`]);
      const coachResult = await client.query(
        `SELECT * FROM tradigo_coaches
         WHERE id=$1 AND approved=true AND availability='AVAILABLE'
           AND COALESCE(profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
           AND NOT EXISTS (
             SELECT 1 FROM tradigo_conduct_reports cr
             WHERE cr.subject_user_id=tradigo_coaches.id AND cr.status IN ('OPEN','IN_REVIEW')
           )
         FOR UPDATE`,
        [candidate.row.id],
      );
      const coach = coachResult.rows[0] as Record<string, any> | undefined;
      if (!coach) continue;
      const policy = await evaluateCoachingPolicy(client, {
        traderId: actor.id,
        coachId: String(coach.id),
        category: "GENERAL_EDUCATION",
        instrumentClass,
        topic,
        agenda,
        learningGoal,
      });
      if (policy.decision === "DENIED") continue;
      const sessionId = `sess_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
      const rateCents = Number(coach.instant_rate_per_minute_cents);
      const bookingKey = idempotencyKey ? `match:${matchGroupId}:${coach.id}` : null;
      await client.query(
        `INSERT INTO tradigo_sessions
          (id,trader_id,coach_id,mode,status,duration_minutes,amount_cents,authorized_amount_cents,
           rate_snapshot_cents,currency,symbol,agenda,topic,coaching_category,instrument_class,payment_status,
           room_name,match_group_id,booking_idempotency_key)
         VALUES ($1,$2,$3,'INSTANT','REQUESTED',$4,$5,$5,$6,$7,$8,$9,$10,'GENERAL_EDUCATION',$11,'NOT_STARTED',$12,$13,$14)`,
        [
          sessionId, actor.id, coach.id, durationMinutes, rateCents * durationMinutes, rateCents,
          coach.currency, symbol || null, agenda, topic || null, instrumentClass, `tradigo-${sessionId}`, matchGroupId, bookingKey,
        ],
      );
      await client.query(
        "INSERT INTO tradigo_rate_snapshots (id,session_id,coach_id,rate_cents,currency,policy) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), sessionId, coach.id, rateCents, coach.currency, { mode: "INSTANT", durationMinutes, matchGroupId, feePercent: 15 }],
      );
      await client.query(
        `INSERT INTO tradigo_learning_records (id,session_id,trader_id,coach_id,learning_goal)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (session_id) DO NOTHING`,
        [randomUUID(), sessionId, actor.id, coach.id, learningGoal || topic || agenda.slice(0, 500)],
      );
      await recordPolicyDecision(client, sessionId, actor.id, policy);
      createdSessionIds.push(sessionId);
    }
    if (!createdSessionIds.length) {
      await client.query("ROLLBACK");
      res.status(422).json({ error: { code: "COACHING_POLICY_DENIED", message: "This request could not be matched within Tradigo's education-only boundaries." } });
      return;
    }
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The live coach search could not be created safely." } });
    return;
  } finally {
    client.release();
  }

  for (const sessionId of createdSessionIds) {
    const candidate = selected[createdSessionIds.indexOf(sessionId)];
    const dimensions = matchQualityDimensions({ mode, instrumentClass, topic, language, durationMinutes, experienceLevel: String(experienceLevel), timezoneBucket });
    await appendEvent(sessionId, actor.id, "REQUESTED", {
      ...dimensions,
      matchGroupId,
      contactedCount: createdSessionIds.length,
    });
    await appendEvent(sessionId, actor.id, "MATCH_CONTACTED", {
      ...dimensions,
      reasonCodes: candidate?.reasonCodes ?? [],
      contactedCount: createdSessionIds.length,
    });
  }
  const view = await matchGroupView(actor.id, matchGroupId);
  res.status(201).json({
    ...view,
    candidates: selected.map((candidate) => ({
      coach: toCoachDto(candidate.row),
      ...candidate.scoreBreakdown,
      matchReasons: candidate.matchReasons,
      reasonCodes: candidate.reasonCodes,
      isEligible: candidate.isEligible,
      ineligibilityReasons: candidate.ineligibilityReasons,
      sessionId: createdSessionIds[selected.indexOf(candidate)] ?? null,
    })),
    searchStats: {
      availableCount: candidatesResult.rowCount ?? 0,
      qualifiedCount: eligible.length,
      contactedCount: createdSessionIds.length,
      expanded: eligible.length < 3,
    },
  });
});

router.post("/sessions/:id/cancel", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can cancel this session." } }); return;
  }
  if (!reason) {
    res.status(400).json({ error: { message: "A cancellation reason is required." } }); return;
  }
  if (session.status === "CANCELLED") {
    res.json({ success: true, idempotent: true, session: toSessionDto(session) });
    return;
  }
  if (!UPCOMING_SESSION_STATUSES.includes(String(session.status))) {
    res.status(409).json({ error: { message: "This session has started or already finished and cannot be cancelled as upcoming." } }); return;
  }
  try {
    const result = await cancelSessionSafely(session, actor.id, reason);
    const updated = await findSession(id);
    res.json({ success: true, idempotent: !result.cancelled, session: toSessionDto(updated!) });
  } catch (error) {
    res.status(502).json({ error: { message: error instanceof Error ? error.message : "The session could not be cancelled safely." } });
  }
});

router.post("/sessions/:id/reschedule", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const scheduledAt = typeof req.body?.scheduledAt === "string" ? new Date(req.body.scheduledAt) : null;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can reschedule this session." } }); return;
  }
  if (session.mode !== "SCHEDULED" || !scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    res.status(400).json({ error: { message: "Choose a future time for a scheduled session." } }); return;
  }
  if (!UPCOMING_SESSION_STATUSES.includes(String(session.status))) {
    res.status(409).json({ error: { message: "Only upcoming sessions can be rescheduled." } }); return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${session.coach_id}`]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
    await ensureSchedulingSchema();
    const locked = await client.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [id]);
    const current = locked.rows[0] as Record<string, any> | undefined;
    if (!current || !UPCOMING_SESSION_STATUSES.includes(String(current.status))) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "This session is no longer reschedulable." } }); return;
    }
    const scheduleCheck = await checkScheduledSlot(client, String(current.coach_id), scheduledAt, Number(current.duration_minutes), id);
    if (!scheduleCheck.ok) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { code: scheduleCheck.code, message: scheduleCheck.message } }); return;
    }
    const previous = current.scheduled_at;
    await client.query(
      "UPDATE tradigo_sessions SET scheduled_at=$1, rescheduled_from=COALESCE(rescheduled_from,$2), updated_at=NOW() WHERE id=$3",
      [scheduledAt, previous, id],
    );
    await client.query("COMMIT");
    await appendEvent(id, actor.id, "SESSION_RESCHEDULED", { from: previous, to: scheduledAt.toISOString() });
    res.json({ success: true, session: toSessionDto((await findSession(id))!) });
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The session could not be rescheduled." } });
  } finally {
    client.release();
  }
});

router.post("/sessions/:id/no-show", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can resolve this session." } }); return;
  }
  if (session.mode !== "SCHEDULED" || !session.scheduled_at) {
    res.status(409).json({ error: { message: "No-show resolution applies only to scheduled sessions." } }); return;
  }
  const scheduledEnd = new Date(new Date(String(session.scheduled_at)).getTime() + Number(session.duration_minutes) * 60_000 + NO_SHOW_GRACE_MINUTES * 60_000);
  if (Date.now() < scheduledEnd.getTime()) {
    res.status(409).json({ error: { message: `No-show resolution becomes available ${NO_SHOW_GRACE_MINUTES} minutes after the scheduled session ends.` } }); return;
  }
  try {
    const resolved = await finalizeNoShow(session, actor.id);
    res.json({ success: true, idempotent: !resolved, session: toSessionDto((await findSession(id))!) });
  } catch (error) {
    res.status(502).json({ error: { message: error instanceof Error ? error.message : "The no-show could not be resolved safely." } });
  }
});

router.patch("/admin/coaches/:id/approval", async (req, res): Promise<void> => {
  if (!await requireModerator(req)) {
    res.status(403).json({ error: { message: "Administrator authentication is required." } });
    return;
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const approved = req.body?.approved === true;
  await ensureIdentitySchema();
  await ensureConductReportsSchema();
  if (approved) {
    const application = await pool.query(
      `SELECT a.status, a.verification
       FROM tradigo_coach_applications a
       WHERE a.applicant_id=$1
       ORDER BY a.updated_at DESC LIMIT 1`,
      [id],
    );
    const applicationRow = application.rows[0] as Record<string, any> | undefined;
    const verification = applicationRow?.verification ?? {};
    const identityDecision = verification.identityDecision ?? {};
    const openReports = await pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_conduct_reports WHERE subject_user_id=$1 AND status IN ('OPEN','IN_REVIEW')",
      [id],
    );
    if (!applicationRow || applicationRow.status !== "APPROVED"
      || verification.identity !== "VERIFIED" || identityDecision.decision !== "VERIFIED"
      || Number(openReports.rows[0]?.count ?? 0) > 0) {
      res.status(409).json({ error: { message: "Coach approval requires an approved evidence review, verified provider identity, and no unresolved conduct reports." } });
      return;
    }
  }
  const result = await pool.query(
    `UPDATE tradigo_coaches
     SET approved = $1,
         verification_status = CASE WHEN $1 THEN 'FULLY_VERIFIED' ELSE verification_status END,
         approval_source = CASE WHEN $1 THEN 'TRADIGO_MODERATION' ELSE approval_source END,
         approved_at = CASE WHEN $1 THEN COALESCE(approved_at, NOW()) ELSE NULL END,
         identity_verified_at = CASE WHEN $1 THEN COALESCE(identity_verified_at, NOW()) ELSE identity_verified_at END,
         availability = CASE WHEN $1 THEN availability ELSE 'OFFLINE' END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [approved, id],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: { message: "Coach not found." } });
    return;
  }
  res.json({ coach: toCoachDto(result.rows[0]) });
});

function bookingMatches(
  session: Record<string, any>,
  actorId: string,
  coachId: string,
  mode: string,
  durationMinutes: number,
  scheduledAt: Date | null,
  agenda: string,
  topic: string,
  coachingCategory: string,
  instrumentClass: string,
): boolean {
  const existingScheduledAt = session.scheduled_at ? new Date(String(session.scheduled_at)).getTime() : null;
  const requestedScheduledAt = scheduledAt ? scheduledAt.getTime() : null;
  return String(session.trader_id) === actorId
    && String(session.coach_id) === coachId
    && String(session.mode) === mode
    && Number(session.duration_minutes) === durationMinutes
    && existingScheduledAt === requestedScheduledAt
    && String(session.agenda ?? "") === agenda
    && String(session.topic ?? "") === topic
    && String(session.coaching_category ?? "GENERAL_EDUCATION") === (coachingCategory || "GENERAL_EDUCATION")
    && String(session.instrument_class ?? "GENERAL") === (instrumentClass || "GENERAL");
}

router.post("/coach-now/requests", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required to request a session." } });
    return;
  }
  await ensureDemoCatalog();
  const coachId = typeof req.body?.coachId === "string" ? req.body.coachId : "";
  const mode = req.body?.mode === "scheduled" ? "SCHEDULED" : "INSTANT";
  const durationMinutes = Number(req.body?.durationMinutes);
  const scheduledAt = typeof req.body?.scheduledAt === "string" && req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
  const agenda = typeof req.body?.agenda === "string" ? req.body.agenda.trim().slice(0, 2000) : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim().slice(0, 240) : "";
  const coachingCategory = typeof req.body?.coachingCategory === "string" ? req.body.coachingCategory.trim().slice(0, 80) : "";
  const instrumentClass = typeof req.body?.instrumentClass === "string" ? req.body.instrumentClass.trim().slice(0, 40) : "";
  const learningGoal = typeof req.body?.learningGoal === "string"
    ? req.body.learningGoal.trim().slice(0, 500)
    : "";
  const rawIdempotencyKey = req.header("idempotency-key")
    ?? (typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined);
  const bookingIdempotencyKey = rawIdempotencyKey?.trim() || null;
  if (
    !coachId ||
    ![10, 25, 50].includes(durationMinutes) ||
    !agenda ||
    (bookingIdempotencyKey && bookingIdempotencyKey.length > 200) ||
    (scheduledAt && Number.isNaN(scheduledAt.getTime())) ||
    (mode === "SCHEDULED" && (!scheduledAt || scheduledAt.getTime() <= Date.now()))
  ) {
    res.status(400).json({ error: { message: "Choose an approved coach, a valid session duration, and a valid date when scheduling." } });
    return;
  }

  const client = await pool.connect();
  let sessionId = "";
  let replayed = false;
  try {
    await client.query("BEGIN");
    if (bookingIdempotencyKey) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`booking:${bookingIdempotencyKey}`]);
    }
    // Every availability and overlap decision for a coach is made while holding
    // the same transaction-scoped lock. A pre-check alone cannot prevent two
    // simultaneous requests from both seeing the same open slot.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${coachId}`]);

    if (bookingIdempotencyKey) {
      const existingResult = await client.query(
        "SELECT * FROM tradigo_sessions WHERE booking_idempotency_key=$1 FOR UPDATE",
        [bookingIdempotencyKey],
      );
      const existing = existingResult.rows[0] as Record<string, any> | undefined;
      if (existing) {
        if (!bookingMatches(existing, actor.id, coachId, mode, durationMinutes, scheduledAt, agenda, topic, coachingCategory, instrumentClass)) {
          await client.query("ROLLBACK");
          res.status(409).json({ error: { status: "IDEMPOTENCY_KEY_REUSED", message: "This booking key was already used for a different session request." } });
          return;
        }
        await client.query("COMMIT");
        sessionId = String(existing.id);
        replayed = true;
      }
    }

    if (!replayed) {
      const coachResult = await client.query(
        `SELECT * FROM tradigo_coaches
         WHERE id = $1 AND approved = true
           AND ($2 = 'SCHEDULED' OR availability = 'AVAILABLE')
           AND COALESCE(profile_change_status, 'CURRENT') <> 'PENDING_REVIEW'
           AND NOT EXISTS (
             SELECT 1 FROM tradigo_conduct_reports cr
             WHERE cr.subject_user_id=tradigo_coaches.id AND cr.status IN ('OPEN','IN_REVIEW')
           )
         FOR SHARE`,
        [coachId, mode],
      );
      const coach = coachResult.rows[0] as Record<string, any> | undefined;
      if (!coach) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { message: "This coach is not available for new requests right now." } });
        return;
      }
      if (mode === "SCHEDULED") {
        const scheduleCheck = await checkScheduledSlot(client, coachId, scheduledAt!, durationMinutes);
        if (!scheduleCheck.ok) {
          await client.query("ROLLBACK");
          res.status(409).json({ error: { status: scheduleCheck.code, message: scheduleCheck.message } });
          return;
        }
      }
      const policy = await evaluateCoachingPolicy(client, {
        traderId: actor.id,
        coachId,
        category: coachingCategory,
        instrumentClass,
        topic,
        agenda,
        learningGoal,
      });
      if (policy.decision === "DENIED") {
        await client.query("ROLLBACK");
        res.status(422).json({
          error: {
            code: "COACHING_POLICY_DENIED",
            message: "This request cannot be accepted because Tradigo supports education only and does not allow signals, guarantees, execution, or account access.",
            reasonCodes: policy.reasonCodes,
            policyVersion: "2026-08-27.education-only.v1",
          },
        });
        return;
      }
      const ratePerMinuteCents = mode === "INSTANT"
        ? Number(coach.instant_rate_per_minute_cents)
        : Math.ceil(Number(coach.hourly_rate_cents) / 60);
      const amountCents = ratePerMinuteCents * durationMinutes;
      sessionId = `sess_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
      await client.query(
         `INSERT INTO tradigo_sessions
           (id, trader_id, coach_id, mode, status, scheduled_at, duration_minutes, amount_cents, authorized_amount_cents, rate_snapshot_cents, currency, agenda, topic, coaching_category, instrument_class, payment_status, room_name, booking_idempotency_key)
           VALUES ($1,$2,$3,$4,'REQUESTED',$5,$6,$7,$7,$8,$9,$10,$11,$12,$13,'NOT_STARTED',$14,$15)`,
         [sessionId, actor.id, coachId, mode, scheduledAt, durationMinutes, amountCents, ratePerMinuteCents, coach.currency, agenda, topic || null, coachingCategory || "GENERAL_EDUCATION", instrumentClass || "GENERAL", `tradigo-${sessionId}`, bookingIdempotencyKey],
      );
      await client.query(
        "INSERT INTO tradigo_rate_snapshots (id, session_id, coach_id, rate_cents, currency, policy) VALUES ($1,$2,$3,$4,$5,$6)",
        [randomUUID(), sessionId, coachId, ratePerMinuteCents, coach.currency, { mode, durationMinutes, feePercent: 15, agenda, coachingCategory: coachingCategory || "GENERAL_EDUCATION", instrumentClass: instrumentClass || "GENERAL", reconnectGraceSeconds: 60 }],
      );
      await client.query(
        `INSERT INTO tradigo_learning_records (id, session_id, trader_id, coach_id, learning_goal)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (session_id) DO NOTHING`,
        [randomUUID(), sessionId, actor.id, coachId, learningGoal || topic || agenda.slice(0, 500)],
      );
      await recordPolicyDecision(client, sessionId, actor.id, policy);
      await client.query("COMMIT");
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The coaching request could not be created safely." } });
    return;
  } finally {
    client.release();
  }

  if (!replayed) await appendEvent(sessionId, actor.id, "REQUESTED", { mode, durationMinutes, agenda, topic });
  const session = await findSession(sessionId);
  res.status(replayed ? 200 : 201).json({ session: toSessionDto(session!), ...(replayed ? { idempotent: true } : {}) });
});

router.get("/coach-now/requests/incoming", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const result = await pool.query(
    "SELECT * FROM tradigo_sessions WHERE coach_id = $1 AND status IN ('REQUESTED','COACH_CLAIMED','PAYMENT_READY','ROOM_READY','ACTIVE') ORDER BY created_at DESC",
    [actor.id],
  );
  res.json({ items: result.rows.map(toSessionDto) });
});

router.get("/coach-now/quality", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  await ensureSchedulingSchema();
  const [coach, openRequests, sessions, events] = await Promise.all([
    pool.query("SELECT availability, availability_timezone FROM tradigo_coaches WHERE id=$1", [actor.id]),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM tradigo_sessions WHERE coach_id=$1 AND status='REQUESTED' AND mode='INSTANT'",
      [actor.id],
    ),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE mode='INSTANT')::int AS requests,
        COUNT(*) FILTER (WHERE mode='INSTANT' AND status='COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE mode='INSTANT' AND status='CANCELLED')::int AS cancelled
      FROM tradigo_sessions
      WHERE coach_id=$1 AND created_at >= NOW() - interval '30 days'
    `, [actor.id]),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type IN ('COACH_CLAIMED','COACH_ACCEPTED','ACCEPTED'))::int AS accepted,
        COUNT(*) FILTER (WHERE event_type='COACH_DECLINED')::int AS coach_declined,
        COUNT(*) FILTER (WHERE event_type IN ('COACH_CLAIM_EXPIRED','MATCH_CLAIM_EXPIRED'))::int AS expired,
        COUNT(*) FILTER (WHERE event_type='NO_SHOW' AND details->>'noShowType'='COACH')::int AS no_show
      FROM tradigo_marketplace_events
      WHERE actor_id=$1 AND occurred_at >= NOW() - interval '30 days'
    `, [actor.id]),
  ]);
  const sessionRow = sessions.rows[0] ?? {};
  const eventRow = events.rows[0] ?? {};
  const requests = Number(sessionRow.requests ?? 0);
  const accepted = Number(eventRow.accepted ?? 0);
  const completed = Number(sessionRow.completed ?? 0);
  res.json({
    feedback: {
      windowDays: 30,
      availability: {
        state: coach.rows[0]?.availability ?? "OFFLINE",
        timezone: coach.rows[0]?.availability_timezone ?? "UTC",
        openRequestCount: Number(openRequests.rows[0]?.count ?? 0),
      },
      reliability: {
        requestCount: requests,
        acceptedCount: accepted,
        completedCount: completed,
        cancelledCount: Number(sessionRow.cancelled ?? 0),
        coachDeclinedCount: Number(eventRow.coach_declined ?? 0),
        claimExpiredCount: Number(eventRow.expired ?? 0),
        coachNoShowCount: Number(eventRow.no_show ?? 0),
        responseRate: requests ? accepted / requests : null,
        completionRate: accepted ? completed / accepted : null,
      },
      guidance: "This is private operational feedback to help tune availability and response habits. It is not a public ranking or punitive score.",
    },
  });
});

router.post("/coach-now/requests/:id/accept", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const session = await findSession(id);
  if (!session || session.coach_id !== actor.id) {
    res.status(404).json({ error: { message: "Session request not found." } });
    return;
  }

  const client = await pool.connect();
  let replayed = false;
  let claimed = false;
  try {
    await client.query("BEGIN");
    // Acceptance is the claim operation for a Coach Now request. The coach
    // lock makes the capacity check and the status transition one atomic unit.
    if (session.match_group_id) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`match:${session.match_group_id}`]);
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`coach:${session.coach_id}`]);
    const lockedResult = await client.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [id]);
    const locked = lockedResult.rows[0] as Record<string, any> | undefined;
    if (!locked || String(locked.coach_id) !== actor.id) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: { message: "Session request not found." } });
      return;
    }
    const controlledDispatch = String(locked.mode) === "INSTANT" && Boolean(locked.match_group_id);
    if (String(locked.status) !== "REQUESTED") {
      if (String(locked.status) === "COACH_CLAIMED" || String(locked.status) === "PAYMENT_READY" || String(locked.status) === "ROOM_READY" || String(locked.status) === "ACTIVE") {
        await client.query("COMMIT");
        replayed = true;
      } else {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { message: "This request is no longer awaiting acceptance." } });
        return;
      }
    }

    if (!replayed) {
      if (String(locked.mode) === "INSTANT") {
        const active = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM tradigo_sessions
           WHERE coach_id=$1 AND mode='INSTANT' AND id<>$2
             AND status = ANY($3::text[])`,
          [actor.id, id, COACH_NOW_ACTIVE_STATUSES],
        );
        if (Number(active.rows[0]?.count ?? 0) >= MAX_ACTIVE_COACH_NOW_REQUESTS) {
          await client.query("ROLLBACK");
          res.status(409).json({
            error: {
              status: "COACH_NOW_CAPACITY_REACHED",
              message: "This coach is already handling the maximum number of Coach Now sessions. Please choose another available coach or try again shortly.",
            },
          });
          return;
        }
      }
      if (controlledDispatch) {
        await client.query(
          `UPDATE tradigo_sessions
           SET status='COACH_CLAIMED', coach_claimed_at=NOW(),
               coach_claim_expires_at=NOW() + ($1 * interval '1 second'), updated_at=NOW()
           WHERE id=$2 AND status='REQUESTED'`,
          [COACH_NOW_CLAIM_SECONDS, id],
        );
        await client.query(
          `UPDATE tradigo_sessions
           SET status='CANCELLED', payment_status='CANCELLED',
               cancellation_reason='Another coach accepted this live match.',
               cancelled_at=NOW(), cancelled_by='system:match', updated_at=NOW()
           WHERE match_group_id=$1 AND id<>$2 AND status='REQUESTED'`,
          [locked.match_group_id, id],
        );
        claimed = true;
      } else {
        const paypal = await createPayPalOrder(Number(locked.amount_cents), id, String(locked.currency));
        if (paypalConfigured() && !paypal.connected) {
          await client.query("ROLLBACK");
          await recordPaymentSetupRetry(id, actor.id).catch(() => undefined);
          res.status(502).json({
            error: {
              code: PAYMENT_SETUP_RETRY_EVENT,
              retryable: true,
              message: "PayPal could not create or confirm the authorization order. Tradigo is retrying the existing payment setup safely; please try accepting this request again shortly.",
            },
          });
          return;
        }
        await client.query(
          `UPDATE tradigo_sessions
           SET status = 'PAYMENT_READY', payment_status = $1, paypal_order_id = $2, payment_approval_url = $3, updated_at = NOW()
           WHERE id = $4 AND status = 'REQUESTED'`,
          [paypal.connected ? "PAYPAL_ORDER_CREATED" : "SANDBOX_TEST_AUTHORIZATION", paypal.orderId ?? null, paypal.approvalUrl ?? null, id],
        );
      }
      await client.query("COMMIT");
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "The coaching request could not be accepted safely." } });
    return;
  } finally {
    client.release();
  }

  if (!replayed) await appendEvent(id, actor.id, claimed ? "COACH_CLAIMED" : "COACH_ACCEPTED", { controlledDispatch: claimed, paypalConnected: paypalConfigured() });
  res.json({ session: toSessionDto((await findSession(id))!), ...(replayed ? { idempotent: true } : {}) });
});

router.post("/coach-now/requests/:id/decline", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  const result = await pool.query(
    `UPDATE tradigo_sessions
     SET status='CANCELLED', payment_status='CANCELLED',
         cancellation_reason='Coach declined the learning request.',
         cancelled_at=NOW(), cancelled_by=$1, updated_at=NOW()
     WHERE id=$2 AND coach_id=$1 AND status='REQUESTED'
     RETURNING id, match_group_id`,
    [actor.id, id],
  );
  if (!result.rows[0]) {
    const existing = await findSession(id);
    if (existing?.coach_id === actor.id && existing.status === "CANCELLED") {
      res.json({ session: toSessionDto(existing), idempotent: true });
      return;
    }
    res.status(409).json({ error: { message: "This request is no longer waiting for a coach response." } });
    return;
  }
  await appendEvent(id, actor.id, "COACH_DECLINED", {
    failureClass: "COACH_DECLINE",
    cancellationReasonCode: "COACH_DECLINED",
    outcome: "DECLINED",
  });
  res.json({ session: toSessionDto((await findSession(id))!) });
});

router.get("/sessions", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor) {
    res.status(401).json({ error: { message: "Sign in is required." } });
    return;
  }
  const field = actor.role === "COACH" ? "coach_id" : "trader_id";
  const sessionListQuery = `SELECT s.*, l.learning_goal, l.status AS learning_status,
      failure.id AS no_show_resolution_failure_id,
      failure.details AS no_show_resolution_failure_details,
      failure.created_at AS no_show_resolution_failure_created_at
    FROM tradigo_sessions s
    LEFT JOIN tradigo_learning_records l ON l.session_id=s.id
    LEFT JOIN LATERAL (
      SELECT id, details, created_at
      FROM tradigo_session_events
      WHERE session_id=s.id AND event_type='NO_SHOW_RESOLUTION_FAILED'
      ORDER BY created_at DESC
      LIMIT 1
    ) failure ON true
    WHERE s.${field} = $1
    ORDER BY s.created_at DESC`;
  const result = await pool.query(sessionListQuery, [actor.id]);
  await Promise.all(result.rows.map((row) => finalizeNoShow(row as Record<string, any>, actor.id).catch(() => false)));
  const refreshed = await pool.query(sessionListQuery, [actor.id]);
  res.json({ items: refreshed.rows.map(toSessionDto) });
});

function payoutAccountDto(row: Record<string, any> | undefined) {
  if (!row) {
    return { provider: "PAYPAL", status: "NOT_STARTED", hasProviderAccount: false, failureCode: null, failureMessage: null };
  }
  const revalidationRequired = requiresPayPalReverification(row);
  return {
    provider: row.provider,
    status: revalidationRequired ? "REVERIFICATION_REQUIRED" : row.status,
    requiresIndependentVerification: revalidationRequired,
    hasProviderAccount: Boolean(row.provider_account_id),
    onboardingUrl: row.status === "PENDING" ? row.onboarding_url : null,
    failureCode: revalidationRequired ? "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED" : row.failure_code ?? null,
    failureMessage: revalidationRequired ? PAYOUT_ACCOUNT_REVERIFICATION_MESSAGE : row.failure_message ?? null,
    verifiedAt: revalidationRequired ? null : row.verified_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function completePayoutOnboarding(coachId: string, state: string, providerAccountId: string): Promise<{ ok: boolean; message?: string }> {
  const parsed = parsePayoutOnboardingState(state);
  if (!parsed || parsed.coachId !== coachId) return { ok: false, message: "The payout onboarding session is invalid or expired. Start onboarding again." };
  if (!providerAccountId || providerAccountId.length > 200 || /@/.test(providerAccountId)) return { ok: false, message: "PayPal must return a provider account reference, not an email address." };
  const pending = await pool.query(
    `UPDATE tradigo_coach_payout_accounts
     SET status='PENDING', provider='PAYPAL', provider_account_id=NULL,
         failure_code='PAYOUT_ACCOUNT_VERIFICATION_UNAVAILABLE',
         failure_message='PayPal returned account details, but Tradigo could not verify the merchant account server-side.',
          verified_at=NULL, ownership_verified_at=NULL, ownership_verification_source=NULL, updated_at=NOW()
     WHERE coach_id=$1 AND onboarding_reference=$2
     RETURNING coach_id`,
    [coachId, parsed.reference],
  );
  if (!pending.rowCount) return { ok: false, message: "The payout onboarding session could not be found. Start onboarding again." };
  return { ok: false, message: "PayPal returned account details, but Tradigo could not verify the merchant account server-side. The account remains pending and no payouts were released." };
}

router.get("/coach/payout-account", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") { res.status(403).json({ error: { message: "A coach account is required." } }); return; }
  await ensurePayoutSchema();
  const result = await pool.query("SELECT * FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [actor.id]);
  res.json({ account: payoutAccountDto(result.rows[0]) });
});

router.post("/coach/payout-account/onboarding", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") { res.status(403).json({ error: { message: "A coach account is required." } }); return; }
  await ensurePayoutSchema();
  const existing = (await pool.query("SELECT * FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [actor.id])).rows[0] as Record<string, any> | undefined;
  if (requiresPayPalReverification(existing)) {
    res.status(409).json({
      error: {
        code: "PAYOUT_ACCOUNT_REVERIFICATION_REQUIRED",
        message: PAYOUT_ACCOUNT_REVERIFICATION_MESSAGE,
      },
      account: payoutAccountDto(existing),
    });
    return;
  }
  if (["READY", "VERIFIED"].includes(String(existing?.status ?? "")) && hasIndependentPayPalVerification(existing)) {
    res.json({ account: payoutAccountDto(existing), alreadyComplete: true });
    return;
  }
  const reference = randomUUID();
  const state = payoutOnboardingState(actor.id, reference, Date.now() + 30 * 60_000);
  let returnUrl: URL;
  try {
    const configuredReturnUrl = process.env.PAYPAL_PAYOUT_RETURN_URL;
    if (!configuredReturnUrl) throw new Error("A fixed HTTPS PayPal payout return URL is required.");
    returnUrl = new URL(configuredReturnUrl);
    if (returnUrl.protocol !== "https:") throw new Error("The PayPal payout return URL must use HTTPS.");
    returnUrl.searchParams.set("state", state);
  } catch (error) {
    req.log.error({ err: error }, "PayPal payout return URL is not safely configured");
    res.status(503).json({ error: { code: "PAYOUT_RETURN_URL_UNAVAILABLE", message: "PayPal payout onboarding is not configured safely. Please contact support." } });
    return;
  }
  const onboardingUrl = await createPayPalPayoutOnboardingLink(actor.id, reference, returnUrl.toString());
  if (!onboardingUrl) {
    await pool.query(
      `INSERT INTO tradigo_coach_payout_accounts (coach_id,provider,status,failure_code,failure_message,updated_at)
       VALUES ($1,'PAYPAL','FAILED','PAYOUT_ONBOARDING_UNAVAILABLE','PayPal payout onboarding is unavailable right now.',NOW())
       ON CONFLICT (coach_id) DO UPDATE SET status='FAILED', provider_account_id=NULL, verified_at=NULL,
         ownership_verified_at=NULL, ownership_verification_source=NULL,
         failure_code=EXCLUDED.failure_code, failure_message=EXCLUDED.failure_message, updated_at=NOW()`,
      [actor.id],
    );
    res.status(503).json({ error: { code: "PAYOUT_ONBOARDING_UNAVAILABLE", message: "PayPal payout onboarding is unavailable right now. Please try again later." }, account: payoutAccountDto({ provider: "PAYPAL", status: "FAILED", failure_code: "PAYOUT_ONBOARDING_UNAVAILABLE", failure_message: "PayPal payout onboarding is unavailable right now." }) });
    return;
  }
  const saved = await pool.query(
    `INSERT INTO tradigo_coach_payout_accounts (coach_id,provider,status,onboarding_reference,onboarding_url,failure_code,failure_message,updated_at)
     VALUES ($1,'PAYPAL','PENDING',$2,$3,NULL,NULL,NOW())
      ON CONFLICT (coach_id) DO UPDATE SET provider='PAYPAL', status='PENDING', provider_account_id=NULL,
        verified_at=NULL, ownership_verified_at=NULL, ownership_verification_source=NULL,
        onboarding_reference=EXCLUDED.onboarding_reference, onboarding_url=EXCLUDED.onboarding_url,
        failure_code=NULL, failure_message=NULL, updated_at=NOW()
     RETURNING *`,
    [actor.id, reference, onboardingUrl],
  );
  res.json({ account: payoutAccountDto(saved.rows[0]), onboardingUrl, state });
});

router.post("/coach/payout-account/complete", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") { res.status(403).json({ error: { message: "A coach account is required." } }); return; }
  await ensurePayoutSchema();
  const state = typeof req.body?.state === "string" ? req.body.state : "";
  const providerAccountId = typeof req.body?.providerAccountId === "string" ? req.body.providerAccountId.trim() : "";
  const result = await completePayoutOnboarding(actor.id, state, providerAccountId);
  if (!result.ok) { res.status(409).json({ error: { code: "PAYOUT_ONBOARDING_INCOMPLETE", message: result.message } }); return; }
  const account = await pool.query("SELECT * FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [actor.id]);
  res.json({ success: true, account: payoutAccountDto(account.rows[0]) });
});

router.get("/coach/payout-account/callback", async (req, res): Promise<void> => {
  await ensurePayoutSchema();
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const parsed = parsePayoutOnboardingState(state);
  const providerAccountId = typeof req.query.merchantIdInPayPal === "string"
    ? req.query.merchantIdInPayPal
    : typeof req.query.providerAccountId === "string" ? req.query.providerAccountId : "";
  if (!parsed || !providerAccountId) { res.status(400).json({ error: { message: "PayPal did not return a valid payout account reference. Start onboarding again." } }); return; }
  const result = await completePayoutOnboarding(parsed.coachId, state, providerAccountId);
  if (!result.ok) { res.redirect("/coach/earnings?onboarding=verification-required"); return; }
  res.redirect("/coach/earnings?onboarding=complete");
});

router.get("/coach/earnings", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "COACH") {
    res.status(403).json({ error: { message: "A coach account is required." } });
    return;
  }
  await ensurePayoutSchema();
  const accountResult = await pool.query("SELECT * FROM tradigo_coach_payout_accounts WHERE coach_id=$1", [actor.id]);

  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS completed_session_count,
        COALESCE(SUM(coach_net_cents) FILTER (WHERE payout_status NOT IN ('REFUNDED','REVERSED','BLOCKED')), 0)::int AS lifetime_earnings_cents,
        COALESCE(SUM(coach_net_cents) FILTER (WHERE completed_at >= date_trunc('month', NOW()) AND payout_status NOT IN ('REFUNDED','REVERSED','BLOCKED')), 0)::int AS month_earnings_cents,
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('HELD','ELIGIBLE','VERIFICATION_HOLD')), 0)::int AS held_cents,
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('PROCESSING','PENDING')), 0)::int AS processing_cents,
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status='PAID'), 0)::int AS paid_cents,
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status='FAILED'), 0)::int AS failed_cents,
        COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status IN ('BLOCKED','REVERSED','REFUNDED')), 0)::int AS blocked_cents,
        MIN(p.hold_until) FILTER (WHERE p.status='HELD' AND p.hold_until > NOW()) AS next_release_at,
       COUNT(*) FILTER (WHERE completed_at >= date_trunc('month', NOW()))::int AS month_session_count
     FROM tradigo_sessions s
     LEFT JOIN tradigo_payouts p ON p.session_id=s.id
    WHERE s.coach_id = $1
      AND s.status = 'COMPLETED'
      AND s.payment_status IN ('SETTLED_SANDBOX', 'PAYPAL_SETTLED')`,
    [actor.id],
  );
  const summary = summaryResult.rows[0] as Record<string, unknown>;
  const recentResult = await pool.query(
    `SELECT s.*, p.id AS payout_id, p.status AS payout_provider_status, p.provider_reference AS payout_provider_reference,
            p.provider_batch_id AS payout_provider_batch_id, p.provider_item_id AS payout_provider_item_id,
            p.hold_until AS payout_hold_until, p.eligible_at AS payout_eligible_at,
            p.attempt_count AS payout_attempt_count, p.next_attempt_at AS payout_next_attempt_at,
            p.last_attempt_at AS payout_last_attempt_at, p.failure_code AS payout_failure_code,
            p.failure_message AS payout_failure_message, p.retryable AS payout_retryable,
            p.reversed_at AS payout_reversed_at, p.reversal_reason AS payout_reversal_reason
     FROM tradigo_sessions s LEFT JOIN tradigo_payouts p ON p.session_id=s.id
     WHERE s.coach_id = $1
       AND s.status = 'COMPLETED'
       AND s.payment_status IN ('SETTLED_SANDBOX', 'PAYPAL_SETTLED')
     ORDER BY s.completed_at DESC NULLS LAST
     LIMIT 12`,
    [actor.id],
  );
  const completedCount = Number(summary.completed_session_count ?? 0);
  const lifetimeEarningsCents = Number(summary.lifetime_earnings_cents ?? 0);

  res.json({
    summary: {
      completedSessionCount: completedCount,
      lifetimeEarningsCents,
      monthEarningsCents: Number(summary.month_earnings_cents ?? 0),
      monthSessionCount: Number(summary.month_session_count ?? 0),
      averageSessionCents: completedCount > 0 ? Math.round(lifetimeEarningsCents / completedCount) : 0,
      heldCents: Number(summary.held_cents ?? 0),
      processingCents: Number(summary.processing_cents ?? 0),
      paidCents: Number(summary.paid_cents ?? 0),
      failedCents: Number(summary.failed_cents ?? 0),
      blockedCents: Number(summary.blocked_cents ?? 0),
      nextReleaseAt: summary.next_release_at ?? null,
    },
    payoutAccount: payoutAccountDto(accountResult.rows[0]),
    items: recentResult.rows.map(toSessionDto),
  });
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(404).json({ error: { message: "Session not found." } });
    return;
  }
  await finalizeNoShow(session, actor.id).catch(() => false);
  const currentSession = await findSession(id);
  if (!currentSession) {
    res.status(404).json({ error: { message: "Session not found." } });
    return;
  }
  await ensureConductReportsSchema();
  const [reviewResult, attendanceResult, learningResult, noShowFailureResult, conductReportResult, paymentSetupResult] = await Promise.all([
    pool.query("SELECT rating, comment, created_at FROM tradigo_reviews WHERE session_id = $1", [id]),
    pool.query(
      `SELECT DISTINCT ON (participant_id) participant_id, event_type, occurred_at
       FROM tradigo_attendance_events WHERE session_id = $1
       ORDER BY participant_id, occurred_at DESC`,
      [id],
    ),
    pool.query("SELECT * FROM tradigo_learning_records WHERE session_id=$1", [id]),
    pool.query(
      `SELECT id, details, created_at
       FROM tradigo_session_events
       WHERE session_id=$1 AND event_type='NO_SHOW_RESOLUTION_FAILED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [id],
    ),
    pool.query(
      `SELECT id, reporter_id, subject_user_id, session_id, reason, details, evidence_reference, status, created_at, updated_at
       FROM tradigo_conduct_reports
       WHERE session_id=$1 AND reporter_id=$2
       ORDER BY created_at DESC
       LIMIT 1`,
      [id, actor.id],
    ),
    pool.query(
      `SELECT id, event_type, details, created_at
       FROM tradigo_session_events
       WHERE session_id=$1 AND event_type IN ($2, 'COACH_ACCEPTED')
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [id, PAYMENT_SETUP_RETRY_EVENT],
    ),
  ]);
  const latestAttendance = new Map(attendanceResult.rows.map((row) => [row.participant_id, row.event_type]));
  const noShowFailure = noShowFailureResult.rows[0] as Record<string, unknown> | undefined;
  const paymentSetupEvent = paymentSetupResult.rows[0] as Record<string, unknown> | undefined;
  const paymentSetupDetails = paymentSetupEvent?.details as Record<string, unknown> | null | undefined;
  const paymentSetupRetrying = paymentSetupEvent?.event_type === PAYMENT_SETUP_RETRY_EVENT;
  res.json({
    session: {
      ...toSessionDto({
        ...currentSession,
        no_show_resolution_failure_id: noShowFailure?.id ?? null,
        no_show_resolution_failure_details: noShowFailure?.details ?? null,
        no_show_resolution_failure_created_at: noShowFailure?.created_at ?? null,
      }),
      paymentSetupStatus: paymentSetupRetrying ? "RETRYING" : null,
      paymentSetupNextAction: paymentSetupRetrying
        ? String(paymentSetupDetails?.nextAction ?? "Tradigo is retrying the existing payment setup. Refresh this session to check for the PayPal approval link.")
        : null,
      learningRecord: toLearningRecordDto(learningResult.rows[0] as Record<string, unknown> | undefined),
      review: reviewResult.rows[0] ? {
        rating: reviewResult.rows[0].rating,
        review: reviewResult.rows[0].comment,
        createdAt: reviewResult.rows[0].created_at,
      } : null,
       conductReport: conductReportResult.rows[0] ? toConductReportDto(conductReportResult.rows[0] as Record<string, unknown>) : null,
       traderPresent: latestAttendance.get(currentSession.trader_id) === "JOIN",
       coachPresent: latestAttendance.get(currentSession.coach_id) === "JOIN",
    },
  });
});

router.get("/learning/passport", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  if (!actor || actor.role !== "TRADER") {
    res.status(403).json({ error: { message: "A trader account is required to view a learning passport." } });
    return;
  }
  const result = await pool.query(
    `SELECT l.*, s.status AS session_status, s.scheduled_at, s.completed_at, s.topic
     FROM tradigo_learning_records l
     JOIN tradigo_sessions s ON s.id=l.session_id
     WHERE l.trader_id=$1
       AND s.status='COMPLETED'
       AND l.status='COMPLETE'
       AND s.dispute_status='NONE'
       AND s.payment_status NOT IN ('REFUND_PENDING','REFUND_FAILED','REFUNDED')
     ORDER BY l.updated_at DESC, l.created_at DESC`,
    [actor.id],
  );
  res.json({ records: result.rows.map((row) => ({
    ...toLearningRecordDto(row as Record<string, unknown>),
    sessionStatus: row.session_status,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    topic: row.topic,
  })) });
});

router.post("/sessions/:id/learning-record", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(404).json({ error: { message: "Session not found." } });
    return;
  }
  if (!["TRADER", "COACH"].includes(actor.role)) {
    res.status(403).json({ error: { message: "Only the trader and coach can update this learning record." } });
    return;
  }
  const existingResult = await pool.query("SELECT * FROM tradigo_learning_records WHERE session_id=$1", [id]);
  const existing = existingResult.rows[0] as Record<string, any> | undefined;
  const terminalLearningSession = ["CANCELLED", "REFUNDED", "DISPUTED", "EXPIRED", "ABANDONED", "NO_SHOW"].includes(String(session.status))
    || ["REFUND_PENDING", "REFUND_FAILED", "REFUNDED"].includes(String(session.payment_status))
    || String(session.dispute_status) !== "NONE";
  if (terminalLearningSession) {
    res.status(409).json({ error: { message: "Learning notes cannot be added to a cancelled, refunded, or disputed session." } });
    return;
  }
  if (actor.role === "TRADER") {
    const goal = typeof req.body?.learningGoal === "string" ? req.body.learningGoal.trim().slice(0, 500) : "";
    const reflection = typeof req.body?.traderReflection === "string" ? req.body.traderReflection.trim().slice(0, 2000) : "";
    if (!goal && !reflection) {
      res.status(400).json({ error: { message: "Add a learning intent or a private reflection before saving." } });
      return;
    }
    if (containsProhibitedTradingActivity(`${goal} ${reflection}`)) {
      res.status(400).json({ error: { message: "Keep the learning record focused on education, process, reflection, and practice—not signals, execution, guarantees, or returns." } });
      return;
    }
    if (["COMPLETED"].includes(String(session.status)) && !existing) {
      res.status(409).json({ error: { message: "This session does not have a learning record to update." } });
      return;
    }
    await pool.query(
      `INSERT INTO tradigo_learning_records (id, session_id, trader_id, coach_id, learning_goal, trader_reflection)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (session_id) DO UPDATE SET
         learning_goal=CASE WHEN $5 <> '' THEN $5 ELSE tradigo_learning_records.learning_goal END,
         trader_reflection=CASE WHEN $6 <> '' THEN $6 ELSE tradigo_learning_records.trader_reflection END,
         updated_at=NOW()`,
      [existing?.id ?? randomUUID(), id, session.trader_id, session.coach_id, goal || existing?.learning_goal || "Coaching practice goal", reflection || existing?.trader_reflection || null],
    );
    await appendEvent(id, actor.id, "LEARNING_GOAL_UPDATED", { learningGoal: goal || existing?.learning_goal, reflectionSaved: Boolean(reflection) });
  } else {
    if (!["ACTIVE", "ENDING", "COMPLETED"].includes(String(session.status))) {
      res.status(409).json({ error: { message: "Coach learning notes can be saved only while the lesson is active or after it has completed." } });
      return;
    }
    if (String(session.status) === "COMPLETED" && Number(session.billable_seconds ?? 0) <= 0) {
      res.status(409).json({ error: { message: "A learning passport requires verified shared attendance; this session had no billable learning time." } });
      return;
    }
    const concepts = typeof req.body?.conceptsReviewed === "string" ? req.body.conceptsReviewed.trim().slice(0, 2000) : "";
    const evidence = typeof req.body?.evidenceDiscussed === "string" ? req.body.evidenceDiscussed.trim().slice(0, 2000) : "";
    const artifact = typeof req.body?.sharedArtifact === "string" ? req.body.sharedArtifact.trim().slice(0, 2000) : "";
    const unresolved = typeof req.body?.unresolvedQuestions === "string" ? req.body.unresolvedQuestions.trim().slice(0, 2000) : "";
    const practice = typeof req.body?.practiceSteps === "string" ? req.body.practiceSteps.trim().slice(0, 2000) : "";
    if (!concepts && !evidence && !artifact && !unresolved && !practice) {
      res.status(400).json({ error: { message: "Add at least one educational observation before saving." } });
      return;
    }
    if (containsProhibitedTradingActivity(`${concepts} ${evidence} ${artifact} ${unresolved} ${practice}`)) {
      res.status(400).json({ error: { message: "Keep the learning record focused on education, process, reflection, and practice—not signals, execution, guarantees, or returns." } });
      return;
    }
    const complete = String(session.status) === "COMPLETED"
      && Boolean(concepts && evidence && artifact && practice);
    await pool.query(
      `INSERT INTO tradigo_learning_records (id, session_id, trader_id, coach_id, learning_goal, concepts_reviewed, evidence_discussed, shared_artifact, unresolved_questions, practice_steps, status, coach_completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $11='COMPLETE' THEN NOW() ELSE NULL END)
       ON CONFLICT (session_id) DO UPDATE SET
         concepts_reviewed=COALESCE(NULLIF($6,''), tradigo_learning_records.concepts_reviewed),
         evidence_discussed=COALESCE(NULLIF($7,''), tradigo_learning_records.evidence_discussed),
         shared_artifact=COALESCE(NULLIF($8,''), tradigo_learning_records.shared_artifact),
         unresolved_questions=COALESCE(NULLIF($9,''), tradigo_learning_records.unresolved_questions),
         practice_steps=COALESCE(NULLIF($10,''), tradigo_learning_records.practice_steps),
         status=CASE WHEN $11='COMPLETE' THEN 'COMPLETE' ELSE 'IN_PROGRESS' END,
         coach_completed_at=CASE WHEN $11='COMPLETE' THEN NOW() ELSE tradigo_learning_records.coach_completed_at END,
         updated_at=NOW()`,
      [existing?.id ?? randomUUID(), id, session.trader_id, session.coach_id, existing?.learning_goal ?? ((typeof session.topic === "string" ? session.topic : "") || (typeof session.agenda === "string" ? session.agenda.slice(0, 500) : "Coaching practice goal")), concepts, evidence, artifact, unresolved, practice, complete ? "COMPLETE" : "IN_PROGRESS"],
    );
    await appendEvent(id, actor.id, "LEARNING_SUMMARY_UPDATED", { complete });
  }
  const saved = await pool.query("SELECT * FROM tradigo_learning_records WHERE session_id=$1", [id]);
  res.json({ learningRecord: toLearningRecordDto(saved.rows[0] as Record<string, unknown>) });
});

router.post("/sessions/:id/payment/authorize", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || actor.role !== "TRADER" || !session || session.trader_id !== actor.id) {
    res.status(403).json({ error: { message: "Only the trader who requested this session can authorize payment." } });
    return;
  }
  if (String(session.status) === "PAYMENT_READY") {
    await appendEvent(id, actor.id, "PAYMENT_AUTHORIZATION_STARTED", {
      paymentStatus: String(session.payment_status || "NOT_STARTED"),
      outcome: "AUTHORIZATION_STARTED",
    });
  }
  const client = await pool.connect();
  let replayed = false;
  let authorizationEvent: Record<string, unknown> | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`session:${id}`]);
    const lockedResult = await client.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [id]);
    const locked = lockedResult.rows[0] as Record<string, any> | undefined;
    if (!locked || String(locked.trader_id) !== actor.id) {
      await client.query("ROLLBACK");
      res.status(403).json({ error: { message: "Only the trader who requested this session can authorize payment." } });
      return;
    }

    // A successful authorization is the terminal operation for this endpoint.
    // Returning the already-authorized session prevents retries from calling
    // PayPal again, while the row lock serializes concurrent first attempts.
    if (String(locked.status) === "ROOM_READY" && AUTHORIZED_PAYMENT_STATUSES.includes(String(locked.payment_status))) {
      await client.query("COMMIT");
      replayed = true;
    } else if (String(locked.status) !== "PAYMENT_READY") {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "This session is not ready for payment authorization." } });
      return;
    } else if (String(locked.payment_status) === "PAYPAL_ORDER_CREATED") {
      if (!locked.paypal_order_id) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { message: "The PayPal order is missing. Ask the coach to reopen the request." } });
        return;
      }
      if (!await verifyPayPalOrder(String(locked.paypal_order_id), locked)) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { message: "PayPal order reference, amount, or currency does not match this session." } });
        return;
      }
      const paypalRequestId = paypalAuthorizationRequestId(id);
      const paypal = await authorizePayPalOrder(String(locked.paypal_order_id), paypalRequestId);
      if (!paypal.authorized) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: { message: "PayPal has not confirmed this authorization. Complete the PayPal sandbox approval, then try again." } });
        return;
      }
      await client.query(
        `UPDATE tradigo_sessions
         SET status = 'ROOM_READY', payment_status = 'PAYPAL_AUTHORIZED', paypal_authorization_id = $1,
             paypal_authorization_status = $2, paypal_authorization_expires_at = $3, updated_at = NOW()
         WHERE id = $4 AND status = 'PAYMENT_READY'`,
        [paypal.authorizationId ?? null, paypal.authorizationStatus ?? null, paypal.authorizationExpiresAt ?? null, id],
      );
      await client.query(`INSERT INTO tradigo_payment_intents (id,session_id,provider,provider_reference,kind,amount_cents,currency,status,idempotency_key,details)
        VALUES ($1,$2,'PAYPAL',$3,'AUTHORIZE',$4,$5,'AUTHORIZED',$6,$7)
        ON CONFLICT (idempotency_key) DO UPDATE SET status='AUTHORIZED', provider_reference=COALESCE(EXCLUDED.provider_reference, tradigo_payment_intents.provider_reference), details=EXCLUDED.details`,
        [randomUUID(), id, locked.paypal_order_id, locked.authorized_amount_cents, locked.currency, paypalRequestId, { authorizationId: paypal.authorizationId }]);
      authorizationEvent = {
        paypalOrderId: locked.paypal_order_id,
        authorizationId: paypal.authorizationId,
        authorizationStatus: paypal.authorizationStatus ?? null,
        authorizationExpiresAt: paypal.authorizationExpiresAt ?? null,
      };
      await client.query("COMMIT");
    } else if (String(locked.payment_status) === "SANDBOX_TEST_AUTHORIZATION" && !paypalConfigured()) {
      await client.query(
        "UPDATE tradigo_sessions SET status = 'ROOM_READY', payment_status = 'AUTHORIZED_SANDBOX', updated_at = NOW() WHERE id = $1 AND status = 'PAYMENT_READY'",
        [id],
      );
      await client.query(`INSERT INTO tradigo_payment_intents (id,session_id,provider,kind,amount_cents,currency,status,idempotency_key,details)
        VALUES ($1,$2,'SANDBOX','AUTHORIZE',$3,$4,'AUTHORIZED',$5,$6)
        ON CONFLICT (idempotency_key) DO UPDATE SET status='AUTHORIZED', details=EXCLUDED.details`,
        [randomUUID(), id, locked.authorized_amount_cents, locked.currency, `authorize:${id}`, { clearlyLabeled: "SANDBOX_TEST_ONLY" }]);
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "This payment cannot be authorized through the demo flow." } });
      return;
    }
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    await appendEvent(id, actor.id, "PAYMENT_AUTHORIZATION_FAILED", {
      failureClass: "PAYMENT_FAILURE",
      retryable: true,
      outcome: "AUTHORIZATION_FAILED",
    }).catch(() => undefined);
    res.status(500).json({ error: { message: error instanceof Error ? error.message : "Payment authorization could not be completed safely." } });
    return;
  } finally {
    client.release();
  }

  if (authorizationEvent) await appendEvent(id, "system:paypal", "PAYPAL_AUTHORIZED", authorizationEvent);
  else if (!replayed) await appendEvent(id, actor.id, "PAYMENT_AUTHORIZED_SANDBOX");
  res.json({ session: toSessionDto((await findSession(id))!), ...(replayed ? { idempotent: true } : {}) });
});

router.post("/sessions/:id/room/token", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can enter this room." } });
    return;
  }
  if (!["ROOM_READY", "ACTIVE"].includes(String(session.status))) {
    res.status(409).json({ error: { message: "The room becomes available after payment authorization." } });
    return;
  }
  if (String(session.mode) === "SCHEDULED" && session.scheduled_at) {
    const scheduledStart = new Date(String(session.scheduled_at)).getTime();
    const scheduledEnd = scheduledStart + Number(session.duration_minutes) * 60_000;
    if (Date.now() < scheduledStart - 15 * 60_000 || Date.now() > scheduledEnd + NO_SHOW_GRACE_MINUTES * 60_000) {
      res.status(409).json({
        error: {
          code: "SCHEDULED_ROOM_WINDOW",
          message: "The scheduled room opens 15 minutes before the start and closes after the 10-minute attendance grace period.",
        },
      });
      return;
    }
  }
  const token = buildLiveKitToken(String(session.room_name), actor);
  if (!token || !process.env.LIVEKIT_URL) {
    await appendEvent(id, actor.id, "ROOM_FAILED", {
      failureClass: "ROOM_FAILURE",
      outcome: "CREDENTIALS_UNAVAILABLE",
      retryable: true,
      roomProvider: "LIVEKIT",
    });
    res.status(503).json({ error: { message: "Live room credentials are not available." } });
    return;
  }
  res.json({ success: true, token, roomName: session.room_name, serverUrl: process.env.LIVEKIT_URL });
});

router.post("/sessions/:id/start", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can start this room." } });
    return;
  }
  if (!["ROOM_READY", "ACTIVE"].includes(String(session.status))) {
    res.status(409).json({ error: { message: "The session is not room-ready yet." } });
    return;
  }
  if (String(session.mode) === "SCHEDULED" && session.scheduled_at) {
    const scheduledStart = new Date(String(session.scheduled_at)).getTime();
    const scheduledEnd = scheduledStart + Number(session.duration_minutes) * 60_000;
    if (Date.now() < scheduledStart - 15 * 60_000) {
      res.status(409).json({ error: { code: "SCHEDULE_TOO_EARLY", message: "The session can start 15 minutes before its scheduled time." } });
      return;
    }
    if (Date.now() > scheduledEnd + NO_SHOW_GRACE_MINUTES * 60_000) {
      res.status(409).json({ error: { code: "SCHEDULE_EXPIRED", message: "This scheduled room has expired and can no longer be started." } });
      return;
    }
  }
  await pool.query(
    "UPDATE tradigo_sessions SET status = 'ACTIVE', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1",
    [id],
  );
  await appendEvent(id, actor.id, "SESSION_STARTED");
  res.json({ session: toSessionDto((await findSession(id))!) });
});

router.post("/sessions/:id/end-request", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only participants can request an end." } }); return;
  }
  if (session.status !== "ACTIVE" || !reason) {
    res.status(409).json({ error: { message: "An active session and a non-empty end reason are required." } }); return;
  }
  await pool.query("UPDATE tradigo_sessions SET end_requested_at = NOW(), end_requested_by = $1, end_reason = $2, updated_at = NOW() WHERE id = $3 AND end_requested_at IS NULL", [actor.id, reason, id]);
  await appendEvent(id, actor.id, "END_REQUESTED", { reason });
  res.json({ session: toSessionDto((await findSession(id))!) });
});

router.post("/sessions/:id/attendance", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const requestedType = typeof req.body?.eventType === "string" ? req.body.eventType.toUpperCase() : "";
  const eventType = requestedType === "LEFT" || requestedType === "LEAVE"
    ? "LEAVE"
    : requestedType === "JOINED" || requestedType === "JOIN"
      ? "JOIN"
      : null;
  const session = await findSession(id);
  if (!actor || !session || !eventType || (session.trader_id !== actor.id && session.coach_id !== actor.id) || !["ROOM_READY", "ACTIVE"].includes(String(session.status))) {
    res.status(409).json({ error: { message: "Only a room-ready participant can report a room signal." } }); return;
  }
  res.status(202).json({
    success: true,
    recorded: false,
    billableAttendanceSource: "LIVEKIT_WEBHOOK",
  });
});

router.post("/sessions/:id/complete", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can complete this room." } });
    return;
  }
  if (session.status === "COMPLETED") {
    res.json({
      session: toSessionDto(session),
      receipt: {
        authorizedAmountCents: Number(session.authorized_amount_cents),
        finalAmountCents: Number(session.final_amount_cents ?? 0),
        billableSeconds: Number(session.billable_seconds ?? 0),
        coachNetCents: Number(session.coach_net_cents ?? 0),
        platformFeeCents: Number(session.platform_fee_cents ?? 0),
        sandbox: session.payment_status === "SETTLED_SANDBOX",
      },
    });
    return;
  }
  const confirmedReason = req.body?.confirm === true && typeof req.body?.reason === "string"
    ? req.body.reason.trim().slice(0, 500)
    : "";
  if (session.status === "ACTIVE" && !session.end_requested_at && confirmedReason) {
    await pool.query(
      "UPDATE tradigo_sessions SET end_requested_at = NOW(), end_requested_by = $1, end_reason = $2, updated_at = NOW() WHERE id = $3 AND end_requested_at IS NULL",
      [actor.id, confirmedReason, id],
    );
    await appendEvent(id, actor.id, "END_REQUESTED", { reason: confirmedReason });
    Object.assign(session, { end_requested_at: new Date(), end_requested_by: actor.id, end_reason: confirmedReason });
  }
  if (session.status !== "ACTIVE" || !session.end_requested_at || !session.end_reason) {
    res.status(409).json({ error: { message: "Only an active session with a confirmed end request can be completed." } });
    return;
  }
  const capSeconds = Number(session.duration_minutes) * 60;
  const attendanceClient = await pool.connect();
  let attendanceRows: Array<{ participant_id: string; event_type: string; occurred_at: Date | string }> = [];
  try {
    await attendanceClient.query("BEGIN");
    const locked = await attendanceClient.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [id]);
    const lockedSession = locked.rows[0] as Record<string, unknown> | undefined;
    if (!lockedSession || lockedSession.status !== "ACTIVE") {
      await attendanceClient.query("ROLLBACK");
      res.status(409).json({ error: { message: "This session was already finalized." } });
      return;
    }
    let snapshotSession = lockedSession;
    if (!snapshotSession.attendance_finalized_at) {
      const frozen = await attendanceClient.query(
        "UPDATE tradigo_sessions SET attendance_finalized_at=NOW() WHERE id=$1 AND attendance_finalized_at IS NULL RETURNING *",
        [id],
      );
      snapshotSession = (frozen.rows[0] as Record<string, unknown> | undefined) ?? lockedSession;
    }
    const attendance = await attendanceClient.query(
      "SELECT participant_id, event_type, occurred_at FROM tradigo_attendance_events WHERE session_id=$1 AND source='LIVEKIT_VERIFIED' ORDER BY occurred_at",
      [id],
    );
    attendanceRows = attendance.rows;
    Object.assign(session, snapshotSession);
    await attendanceClient.query("COMMIT");
  } catch (error) {
    await attendanceClient.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    attendanceClient.release();
  }
  const snapshotAt = new Date(String(session.attendance_finalized_at)).getTime();
  const seconds = attendanceOverlapSeconds(attendanceRows.map((row) => ({ participantId: row.participant_id, eventType: row.event_type, occurredAt: new Date(row.occurred_at) })), String(session.trader_id), String(session.coach_id), capSeconds, snapshotAt);
  const finalAmount = Math.min(Number(session.authorized_amount_cents), Math.ceil(seconds / 60) * Number(session.rate_snapshot_cents));
  const coachNet = Math.floor(finalAmount * 0.85); const fee = finalAmount - coachNet;
  await ensurePayoutSchema();
  let payPalCaptureId: string | undefined;
  if (session.payment_status === "PAYPAL_AUTHORIZED") {
    if (!session.paypal_authorization_id) {
      res.status(502).json({ error: { message: "The PayPal authorization is missing; the session remains active." } }); return;
    }
    if (finalAmount === 0) {
      if (!await voidPayPalAuthorization(String(session.paypal_authorization_id), `void:${id}`)) {
        res.status(502).json({ error: { message: "PayPal void failed; the session remains active." } }); return;
      }
    } else {
      if (session.paypal_authorization_expires_at
        && new Date(String(session.paypal_authorization_expires_at)).getTime() <= Date.now()) {
        res.status(409).json({
          error: {
            code: "PAYPAL_AUTHORIZATION_EXPIRED",
            message: "The PayPal authorization has expired. Capture is blocked; contact support to renew payment before proceeding.",
          },
          session: toSessionDto(session),
        });
        return;
      }
      const capture = await capturePayPalAuthorization(
        String(session.paypal_authorization_id),
        `capture:${id}`,
        finalAmount,
        String(session.currency),
      );
      if (!capture.captured) {
        res.status(502).json({ error: { code: "PAYPAL_CAPTURE_FAILED", message: "PayPal capture failed; the session remains active. Do not mark the session settled until the payment hold is confirmed." } }); return;
      }
      payPalCaptureId = capture.captureId;
    }
  } else if (session.payment_status !== "AUTHORIZED_SANDBOX") {
    res.status(409).json({ error: { message: "A valid authorization is required before completion." } }); return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM tradigo_sessions WHERE id = $1 FOR UPDATE", [id]);
    if (locked.rows[0]?.status !== "ACTIVE") { await client.query("ROLLBACK"); res.status(409).json({ error: { message: "This session was already finalized." } }); return; }
    const paymentStatus = session.payment_status === "PAYPAL_AUTHORIZED" ? "PAYPAL_SETTLED" : "SETTLED_SANDBOX";
    await client.query(`UPDATE tradigo_sessions SET status='COMPLETED', payment_status=$1, final_amount_cents=$2, billable_seconds=$3, platform_fee_cents=$4, coach_net_cents=$5, attendance_finalized_at=COALESCE(attendance_finalized_at,NOW()), completed_at=NOW(), payout_status='HELD', updated_at=NOW() WHERE id=$6`, [paymentStatus, finalAmount, seconds, fee, coachNet, id]);
    const entries = [
      ["CUSTOMER_CHARGE", "customer_clearing", -finalAmount],
      ["CUSTOMER_CHARGE", "platform_cash", finalAmount],
      ["COACH_PAYABLE", "platform_cash", -coachNet],
      ["COACH_PAYABLE", "coach_payable", coachNet],
      ["PLATFORM_FEE", "platform_cash", -fee],
      ["PLATFORM_FEE", "platform_revenue", fee],
    ];
    for (const [index, [type, account, amount]] of entries.entries()) await client.query(`INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (idempotency_key) DO NOTHING`, [randomUUID(), id, type, account, amount, session.currency, `complete:${id}:${type}:${account}:${index}`]);
    await client.query(`INSERT INTO tradigo_payment_intents (id,session_id,provider,provider_reference,kind,amount_cents,currency,status,idempotency_key,details) VALUES ($1,$2,$3,$4,'CAPTURE',$5,$6,'SETTLED',$7,$8) ON CONFLICT (idempotency_key) DO NOTHING`, [randomUUID(), id, session.payment_status === "PAYPAL_AUTHORIZED" ? "PAYPAL" : "SANDBOX", session.paypal_authorization_id, finalAmount, session.currency, `capture:${id}`, { billableSeconds: seconds }]);
    if (payPalCaptureId) {
      await client.query(
        "UPDATE tradigo_payment_intents SET provider_reference = $1 WHERE idempotency_key = $2",
        [payPalCaptureId, `capture:${id}`],
      );
    }
    await client.query(`INSERT INTO tradigo_payouts (id,session_id,coach_id,amount_cents,currency,status,hold_until) VALUES ($1,$2,$3,$4,$5,'HELD',NOW() + ($6 * interval '1 minute')) ON CONFLICT (session_id) DO NOTHING`, [randomUUID(), id, session.coach_id, coachNet, session.currency, payoutHoldMinutes()]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  await appendEvent(id, actor.id, "SESSION_COMPLETED", { billableSeconds: seconds, finalAmountCents: finalAmount });
  res.json({ session: toSessionDto((await findSession(id))!), receipt: { authorizedAmountCents: Number(session.authorized_amount_cents), finalAmountCents: finalAmount, billableSeconds: seconds, coachNetCents: coachNet, platformFeeCents: fee, sandbox: session.payment_status === "AUTHORIZED_SANDBOX" } });
});

router.post(["/sessions/:id/review", "/sessions/:id/reviews"], async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req); const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rating = Number(req.body?.rating);
  const rawComment = typeof req.body?.comment === "string" ? req.body.comment : req.body?.review;
  const comment = typeof rawComment === "string" ? rawComment.trim().slice(0, 2000) : null;
  const session = await findSession(id);
  if (!actor || actor.role !== "TRADER" || !session || session.trader_id !== actor.id) { res.status(403).json({ error: { message: "Only the session trader can leave a review." } }); return; }
  if (session.status !== "COMPLETED" || !Number.isInteger(rating) || rating < 1 || rating > 5) { res.status(409).json({ error: { message: "Completed sessions require a rating from 1 to 5." } }); return; }
  const client = await pool.connect();
  let result;
  try {
    await client.query("BEGIN");
    result = await client.query("INSERT INTO tradigo_reviews (id,session_id,trader_id,coach_id,rating,comment) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (session_id) DO NOTHING RETURNING id", [randomUUID(), id, actor.id, session.coach_id, rating, comment]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "A review already exists for this session." } });
      return;
    }
    await client.query(
      `UPDATE tradigo_coaches c
       SET rating_average_tenths=COALESCE(stats.average_tenths, 0),
           rating_count=COALESCE(stats.review_count, 0),
           updated_at=NOW()
       FROM (
         SELECT coach_id, ROUND(AVG(rating) * 10)::int AS average_tenths, COUNT(*)::int AS review_count
         FROM tradigo_reviews
         WHERE coach_id=$1
         GROUP BY coach_id
       ) stats
       WHERE c.id=stats.coach_id`,
      [session.coach_id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    throw error;
  }
  client.release();
  await appendEvent(id, actor.id, "REVIEW_SUBMITTED", { rating }); res.status(201).json({ success: true });
});

router.post("/sessions/:id/disputes", async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req); const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 2000) : "";
  if (!actor || !reason) { res.status(403).json({ error: { message: "A participant and a dispute reason are required." } }); return; }
  await ensureSchedulingSchema();
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS tradigo_disputes_one_open_per_session_idx ON tradigo_disputes(session_id) WHERE status='OPEN'");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query("SELECT * FROM tradigo_sessions WHERE id=$1 FOR UPDATE", [id]);
    const session = sessionResult.rows[0] as Record<string, unknown> | undefined;
    if (!session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
      await client.query("ROLLBACK");
      res.status(403).json({ error: { message: "A participant and a dispute reason are required." } });
      return;
    }
    const existing = await client.query(
      "SELECT id FROM tradigo_disputes WHERE session_id=$1 AND status='OPEN' LIMIT 1",
      [id],
    );
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "An open dispute already exists for this session." } });
      return;
    }
    await client.query("INSERT INTO tradigo_disputes (id,session_id,opened_by,reason) VALUES ($1,$2,$3,$4)", [randomUUID(), id, actor.id, reason]);
    await client.query("UPDATE tradigo_sessions SET dispute_status='OPEN', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string })?.code === "23505") {
      res.status(409).json({ error: { message: "An open dispute already exists for this session." } });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
  await appendEvent(id, actor.id, "DISPUTE_OPENED", { reason }); res.status(201).json({ success: true, payoutStatus: "FROZEN" });
});

router.post(["/sessions/:id/conduct-reports", "/sessions/:id/conduct-report"], async (req, res): Promise<void> => {
  const actor = await requireDemoActor(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = await findSession(id);
  if (!actor || !session || (session.trader_id !== actor.id && session.coach_id !== actor.id)) {
    res.status(403).json({ error: { message: "Only session participants can submit a conduct report." } });
    return;
  }
  if (!["ACTIVE", "COMPLETED"].includes(String(session.status))) {
    res.status(409).json({ error: { message: "Conduct reports are available while a session is active or after it has completed." } });
    return;
  }

  const reasonValue = req.body?.reason ?? req.body?.reasonCode;
  const reason = typeof reasonValue === "string" ? reasonValue.trim().slice(0, 160) : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim().slice(0, 4000) : "";
  const evidenceValue = req.body?.evidenceReference ?? req.body?.evidenceUrl ?? req.body?.evidence;
  const evidenceReference = typeof evidenceValue === "string"
    ? evidenceValue.trim().slice(0, 2000)
    : "";
  if (reason.length < 3 || details.length < 3) {
    res.status(400).json({ error: { message: "Choose a reason and describe what happened before submitting the report." } });
    return;
  }

  await ensureConductReportsSchema();
  const suppliedKey = typeof req.header("idempotency-key") === "string"
    ? req.header("idempotency-key")!.trim().slice(0, 180)
    : typeof req.body?.idempotencyKey === "string"
      ? req.body.idempotencyKey.trim().slice(0, 180)
      : "";
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ actorId: actor.id, sessionId: id, reason, details, evidenceReference }))
    .digest("hex");
  const idempotencyKey = `conduct-report:${actor.id}:${id}:${suppliedKey || fingerprint}`;
  const subjectUserId = session.trader_id === actor.id ? String(session.coach_id) : String(session.trader_id);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT * FROM tradigo_conduct_reports WHERE idempotency_key=$1 FOR UPDATE",
      [idempotencyKey],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      res.status(200).json({ report: toConductReportDto(existing.rows[0] as Record<string, unknown>), idempotent: true });
      return;
    }
    const inserted = await client.query(
      `INSERT INTO tradigo_conduct_reports
        (id, reporter_id, subject_user_id, session_id, reason, details, evidence_reference, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [randomUUID(), actor.id, subjectUserId, id, reason, details, evidenceReference || null, idempotencyKey],
    );
    if (!inserted.rows[0]) {
      const replay = await client.query("SELECT * FROM tradigo_conduct_reports WHERE idempotency_key=$1", [idempotencyKey]);
      await client.query("COMMIT");
      res.status(200).json({ report: toConductReportDto(replay.rows[0] as Record<string, unknown>), idempotent: true });
      return;
    }
    await client.query("COMMIT");
    await appendEvent(id, actor.id, "CONDUCT_REPORT_SUBMITTED", {
      reportId: inserted.rows[0].id,
      subjectUserId,
      reason,
      evidenceReference: evidenceReference || null,
    });
    res.status(201).json({ report: toConductReportDto(inserted.rows[0] as Record<string, unknown>), idempotent: false });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to submit conduct report");
    res.status(500).json({ error: { message: "The conduct report could not be saved." } });
  } finally {
    client.release();
  }
});

router.post("/webhooks/livekit", async (req, res): Promise<void> => {
  const secret = process.env.LIVEKIT_API_SECRET;
  const authorization = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const tokenParts = authorization?.split(".");
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!secret || !tokenParts || tokenParts.length !== 3) {
    res.status(401).json({ error: { message: "Invalid LiveKit webhook authorization." } }); return;
  }
  const expectedSignature = createHmac("sha256", secret).update(`${tokenParts[0]}.${tokenParts[1]}`).digest("base64url");
  const actualSignature = tokenParts[2];
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expectedSignature))) {
    res.status(401).json({ error: { message: "Invalid LiveKit webhook signature." } }); return;
  }
  let claims: { exp?: number; sha256?: string };
  try {
    claims = JSON.parse(Buffer.from(tokenParts[1], "base64url").toString("utf8")) as { exp?: number; sha256?: string };
  } catch {
    res.status(401).json({ error: { message: "Invalid LiveKit webhook claims." } }); return;
  }
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000) || !claims.sha256 || claims.sha256 !== bodyHash) {
    res.status(401).json({ error: { message: "Expired or mismatched LiveKit webhook." } }); return;
  }
  const body = req.body as { room?: { name?: string }; event?: string; participant?: { identity?: string } };
  const eventType = /left|disconnected/i.test(body.event ?? "") ? "LEAVE" : /joined|connected/i.test(body.event ?? "") ? "JOIN" : null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query("SELECT * FROM tradigo_sessions WHERE room_name=$1 FOR UPDATE", [body.room?.name]);
    const session = sessionResult.rows[0] as Record<string, unknown> | undefined;
    if (
      !session
      || !eventType
      || !body.participant?.identity
      || ![session.trader_id, session.coach_id].includes(body.participant.identity)
      || !["ROOM_READY", "ACTIVE"].includes(String(session.status))
      || session.attendance_finalized_at
    ) {
      await client.query("ROLLBACK");
      res.status(204).end();
      return;
    }
    const inserted = await client.query(
      `INSERT INTO tradigo_attendance_events (id, session_id, participant_id, event_type, occurred_at, source, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'LIVEKIT_VERIFIED',$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [randomUUID(), session.id, body.participant.identity, eventType, new Date(), `livekit:${bodyHash}:${body.event}:${body.participant.identity}`],
    );
    await client.query("COMMIT");
    if (inserted.rows[0] && eventType === "JOIN") {
      await appendEvent(String(session.id), String(body.participant.identity), "ATTENDANCE_JOIN", { source: "LIVEKIT_VERIFIED" });
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "Failed to record verified LiveKit attendance");
    res.status(500).json({ error: { message: "Unable to record verified room attendance." } });
    return;
  } finally {
    client.release();
  }
  res.status(204).end();
});

router.post("/webhooks/identity-provider", handleIdentityProviderWebhook);
router.post("/webhooks/provider-identity", handleIdentityProviderWebhook);
router.post("/webhooks/identity", handleIdentityProviderWebhook);

router.post("/webhooks/paypal", async (req, res): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value[0] : value || ""]));
  if (!await verifyPayPalWebhook(headers, req.body)) {
    res.status(400).json({ error: { message: "PayPal webhook signature verification failed." } });
    return;
  }
  const event = req.body as Record<string, any>;
  const eventId = typeof event.id === "string" ? event.id : createHash("sha256").update(rawBody).digest("hex");
  const resource = (event.resource || {}) as Record<string, any>;
  const resourceId = typeof resource.id === "string" ? resource.id : null;
  const inserted = await pool.query(
    `INSERT INTO tradigo_payment_webhook_events (id,event_id,event_type,resource_id,status,payload)
     VALUES ($1,$2,$3,$4,'RECEIVED',$5) ON CONFLICT (event_id) DO NOTHING RETURNING id`,
    [randomUUID(), eventId, String(event.event_type || "UNKNOWN"), resourceId, event],
  );
  if (!inserted.rowCount) { res.status(200).json({ received: true, duplicate: true }); return; }
  try {
    const result = await reconcilePayPalEvent(event);
    await pool.query(
      "UPDATE tradigo_payment_webhook_events SET status=$1, session_id=$2, error=$3, processed_at=NOW() WHERE event_id=$4",
      [result.status, result.sessionId ?? null, result.error ?? null, eventId],
    );
    res.status(200).json({ received: true, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook reconciliation failed.";
    await pool.query("UPDATE tradigo_payment_webhook_events SET status='FAILED', error=$1, processed_at=NOW() WHERE event_id=$2", [message, eventId]);
    // A 2xx prevents PayPal from hiding a locally recorded failure behind retries.
    res.status(200).json({ received: true, status: "FAILED" });
  }
});

router.get("/admin/paypal/webhook-status", async (req, res): Promise<void> => {
  if (!await requireModerator(req)) { res.status(403).json({ error: { message: "Moderator authentication is required." } }); return; }
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count, MAX(received_at) AS last_received_at
     FROM tradigo_payment_webhook_events GROUP BY status ORDER BY status`,
  );
  res.json({
    configured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
    provider: paypalConfigured() ? "PAYPAL" : "NOT_CONFIGURED",
    events: result.rows,
  });
});

router.get("/admin/payouts", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  await ensurePayoutSchema();
  const result = await pool.query(
    `SELECT p.*, s.status AS session_status, s.payment_status, s.dispute_status,
             c.display_name AS coach_name,
             CASE
               WHEN a.status IN ('READY','VERIFIED')
                 AND a.provider_account_id IS NOT NULL
                 AND NOT (
                   a.ownership_verified_at IS NOT NULL
                   AND a.ownership_verification_source IN ('PAYPAL_PARTNER_API','PAYPAL_AUTHENTICATED_WEBHOOK')
                 )
               THEN 'REVERIFICATION_REQUIRED'
               ELSE COALESCE(a.status,'NOT_STARTED')
             END AS payout_account_status
     FROM tradigo_payouts p
     JOIN tradigo_sessions s ON s.id=p.session_id
     LEFT JOIN tradigo_coaches c ON c.id=p.coach_id
     LEFT JOIN tradigo_coach_payout_accounts a ON a.coach_id=p.coach_id
     ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
     LIMIT 200`,
  );
  res.json({
    items: result.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      coachId: row.coach_id,
      coachName: row.coach_name ?? row.coach_id,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      providerReference: row.provider_reference,
      providerBatchId: row.provider_batch_id,
      providerItemId: row.provider_item_id,
      holdUntil: row.hold_until,
      eligibleAt: row.eligible_at,
      attemptCount: Number(row.attempt_count ?? 0),
      nextAttemptAt: row.next_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      failureCode: row.failure_code,
      failureMessage: row.failure_message,
      retryable: row.retryable !== false,
      reversedAt: row.reversed_at,
      reversalReason: row.reversal_reason,
      sessionStatus: row.session_status,
      paymentStatus: row.payment_status,
      disputeStatus: row.dispute_status,
      payoutAccountStatus: row.payout_account_status ?? "NOT_STARTED",
    })),
  });
});

router.post("/admin/payouts/:id/retry", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  await ensurePayoutSchema();
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await pool.query(
    `UPDATE tradigo_payouts
     SET status=CASE WHEN status='FAILED' THEN 'ELIGIBLE' ELSE status END,
         retryable=true, next_attempt_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND status='FAILED'
     RETURNING *`,
    [id],
  );
  if (!result.rowCount) { res.status(409).json({ error: { message: "Only a failed payout can be queued for retry." } }); return; }
  await pool.query("UPDATE tradigo_sessions SET payout_status='ELIGIBLE', updated_at=NOW() WHERE id=$1", [result.rows[0].session_id]);
  await pool.query(
    `INSERT INTO tradigo_ledger_entries (id,session_id,entry_type,account,amount_cents,currency,idempotency_key,details)
     VALUES ($1,$2,'PAYOUT_RETRY_QUEUED','coach_payable',0,$3,$4,$5) ON CONFLICT (idempotency_key) DO NOTHING`,
    [randomUUID(), result.rows[0].session_id, result.rows[0].currency, `payout:${id}:admin-retry:${result.rows[0].attempt_count}`, { moderatorId: moderator.id }],
  );
  res.json({ success: true, status: "ELIGIBLE", payoutId: id });
});

router.get("/admin/paypal/reconciliation", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  const result = await pool.query(
    `SELECT e.*, s.payment_status, s.payout_status
     FROM tradigo_payment_webhook_events e
     LEFT JOIN tradigo_sessions s ON s.id=e.session_id
      WHERE e.status IN ('FAILED','RETRY_REQUIRED') OR jsonb_array_length(COALESCE(e.payload->'_retryHistory','[]'::jsonb)) > 0
     ORDER BY e.received_at DESC LIMIT 100`,
  );
  res.json({ items: result.rows.map((row) => ({ ...row, retry_count: Array.isArray(row.payload?._retryHistory) ? row.payload._retryHistory.length : 0, last_retry_at: row.payload?._lastRetryAt ?? null, retry_history: row.payload?._retryHistory ?? [] })) });
});

router.get("/admin/no-show/failures", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  const result = await pool.query(
    `SELECT e.id, e.session_id, e.actor_id, e.details, e.created_at,
            s.trader_id, s.coach_id, s.status, s.payment_status, s.payout_status
     FROM tradigo_session_events e
     JOIN tradigo_sessions s ON s.id=e.session_id
     WHERE e.event_type='NO_SHOW_RESOLUTION_FAILED'
     ORDER BY e.created_at DESC
     LIMIT 100`,
  );
  res.json({ items: result.rows.map((row) => ({
    ...row,
    needsAttention: row.status !== "CANCELLED" || ["PAYPAL_AUTHORIZED", "PAYPAL_SETTLED", "REFUND_PENDING", "REFUND_FAILED"].includes(String(row.payment_status)),
  })) });
});

router.get("/admin/paypal/authorization-health", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  const result = await pool.query(
    `SELECT id, trader_id, coach_id, scheduled_at, status, payment_status,
            paypal_authorization_id, paypal_authorization_status, paypal_authorization_expires_at
     FROM tradigo_sessions
     WHERE mode = 'SCHEDULED'
       AND status IN ('ROOM_READY','ACTIVE')
       AND payment_status = 'PAYPAL_AUTHORIZED'
       AND paypal_authorization_id IS NOT NULL
       AND paypal_authorization_expires_at IS NOT NULL
       AND paypal_authorization_expires_at <= NOW() + interval '24 hours'
     ORDER BY paypal_authorization_expires_at ASC`,
  );
  res.json({
    items: result.rows.map((row) => ({
      ...row,
      expired: new Date(String(row.paypal_authorization_expires_at)).getTime() <= Date.now(),
      nextAction: new Date(String(row.paypal_authorization_expires_at)).getTime() <= Date.now()
        ? "Block capture and contact both participants to renew payment."
        : "Ask both participants to start the session before the authorization expires.",
    })),
  });
});

router.post("/admin/paypal/reconciliation/:eventId/retry", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator) { res.status(403).json({ error: { message: "A signed moderator or admin account is required." } }); return; }
  const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
  const client = await pool.connect();
  let event: Record<string, any> | undefined;
  let attempt = 0;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT * FROM tradigo_payment_webhook_events WHERE event_id=$1 FOR UPDATE",
      [eventId],
    );
    event = result.rows[0] as Record<string, any> | undefined;
    if (!event) { await client.query("ROLLBACK"); res.status(404).json({ error: { message: "Reconciliation event not found." } }); return; }
    if (event.event_type !== "PAYMENT.REFUND.FAILED" || !["FAILED", "RETRY_REQUIRED"].includes(event.status)) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: { message: "Only failed PayPal refund events are eligible for retry.", status: event.status } });
      return;
    }
    const retryHistory = Array.isArray(event.payload?._retryHistory) ? event.payload._retryHistory : [];
    attempt = retryHistory.filter((entry: unknown) => (
      entry !== null && typeof entry === "object" && (entry as { status?: unknown }).status === "RETRYING"
    )).length + 1;
    await client.query(
      "UPDATE tradigo_payment_webhook_events SET status='RETRYING', payload=jsonb_set(jsonb_set(payload,'{_retryHistory}',COALESCE(payload->'_retryHistory','[]'::jsonb) || $1::jsonb,true),'{_lastRetryAt}',to_jsonb(NOW()),true) WHERE event_id=$2",
      [JSON.stringify([{ attempt, status: "RETRYING", startedAt: new Date().toISOString(), moderatorId: moderator.id, moderatorRole: moderator.role, moderatorEmail: moderator.email ?? null }]), eventId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    throw error;
  }
  client.release();

  const resource = (event.payload?.resource || {}) as Record<string, any>;
  const sessionId = event.session_id as string | undefined;
  if (!sessionId) {
    const message = "The failed refund is not linked to a Tradigo session.";
    await pool.query("UPDATE tradigo_payment_webhook_events SET status='FAILED', error=$1, payload=jsonb_set(payload,'{_retryHistory}',COALESCE(payload->'_retryHistory','[]'::jsonb) || $2::jsonb,true) WHERE event_id=$3", [message, JSON.stringify([{ attempt, status: "FAILED", error: message, completedAt: new Date().toISOString(), moderatorId: moderator.id, moderatorRole: moderator.role, moderatorEmail: moderator.email ?? null }]), eventId]);
    res.status(409).json({ error: { message } });
    return;
  }
  const session = await findSession(sessionId);
  if (!session) { res.status(404).json({ error: { message: "Session linked to reconciliation event was not found." } }); return; }

  const captureFromEvent = resource.supplementary_data?.related_ids?.capture_id;
  const captureResult = await pool.query(
    "SELECT provider_reference FROM tradigo_payment_intents WHERE session_id=$1 AND kind='CAPTURE' AND provider='PAYPAL' AND provider_reference IS NOT NULL ORDER BY created_at DESC LIMIT 1",
    [session.id],
  );
  const captureId = (typeof captureFromEvent === "string" && captureFromEvent) || captureResult.rows[0]?.provider_reference as string | undefined;
  const finishRetry = async (status: "RECONCILED" | "RETRY_REQUIRED" | "FAILED", error?: string) => {
    await pool.query(
      "UPDATE tradigo_payment_webhook_events SET status=$1, error=$2, processed_at=NOW(), payload=jsonb_set(payload,'{_retryHistory}',COALESCE(payload->'_retryHistory','[]'::jsonb) || $3::jsonb,true) WHERE event_id=$4",
      [status, error ?? null, JSON.stringify([{ attempt, status, error: error ?? null, completedAt: new Date().toISOString(), moderatorId: moderator.id, moderatorRole: moderator.role, moderatorEmail: moderator.email ?? null }]), eventId],
    );
  };
  if (!captureId) {
    const message = "PayPal capture reference is missing.";
    await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
    await finishRetry("FAILED", message);
    res.status(409).json({ error: { message }, retry: { attempt, status: "FAILED" } });
    return;
  }

  const refund = await refundPayPalCapture(captureId, `refund-retry:${eventId}:${attempt}`);
  if (!refund.ok) {
    const message = refund.error || "PayPal refund failed.";
    await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
    await finishRetry("FAILED", message);
    await appendEvent(String(session.id), moderator.id, "REFUND_RETRY_FAILED", { eventId, attempt, captureId, error: message, moderatorRole: moderator.role, moderatorEmail: moderator.email });
    res.status(502).json({ error: { message }, retry: { attempt, status: "FAILED" } });
    return;
  }

  const refundReference = refund.refundId || captureId;
  if (refund.status === "PENDING") {
    await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_PENDING', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
  } else {
    const reconciled = await reconcilePayPalEvent({
      id: `refund-retry:${eventId}:${attempt}`,
      event_type: "PAYMENT.REFUNDED",
      resource: { id: refundReference, custom_id: session.id, status: "COMPLETED", amount: { value: (Number(session.final_amount_cents || 0) / 100).toFixed(2) } },
    });
    if (reconciled.status === "FAILED") {
      await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
      await finishRetry("FAILED", reconciled.error || "Local refund reconciliation failed.");
      res.status(502).json({ error: { message: "PayPal refund succeeded but local reconciliation failed.", details: reconciled.error }, retry: { attempt, status: "FAILED", providerReference: refundReference } });
      return;
    }
    await pool.query("UPDATE tradigo_sessions SET payment_status='REFUNDED', payout_status='REFUNDED', updated_at=NOW() WHERE id=$1", [session.id]);
  }
  await finishRetry(refund.status === "PENDING" ? "RETRY_REQUIRED" : "RECONCILED");
  await appendEvent(String(session.id), moderator.id, "REFUND_RETRY_SUCCEEDED", { eventId, attempt, providerReference: refundReference, providerStatus: refund.status || "COMPLETED", moderatorRole: moderator.role, moderatorEmail: moderator.email });
  res.json({ success: true, retry: { attempt, status: refund.status === "PENDING" ? "PENDING" : "RECONCILED", providerReference: refundReference }, session: { id: session.id, paymentStatus: refund.status === "PENDING" ? "REFUND_PENDING" : "REFUNDED", payoutStatus: refund.status === "PENDING" ? "FROZEN" : "REFUNDED" } });
});

router.get("/admin/disputes", async (req, res): Promise<void> => {
  if (!await requireModerator(req)) { res.status(403).json({ error: { message: "Moderator authentication is required." } }); return; }
  const result = await pool.query("SELECT d.*, s.payout_status, s.payment_status FROM tradigo_disputes d JOIN tradigo_sessions s ON s.id=d.session_id ORDER BY d.created_at DESC");
  res.json({ items: result.rows });
});

router.post("/admin/disputes/:id/resolve", async (req, res): Promise<void> => {
  const moderator = await getModeratorIdentity(req);
  if (!moderator && !await requireModerator(req)) { res.status(403).json({ error: { message: "Moderator authentication is required." } }); return; }
  const disputeId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const resolution = req.body?.resolution === "REFUND" ? "REFUND" : "RELEASE";
  const reasonCode = typeof req.body?.reasonCode === "string"
    ? req.body.reasonCode.trim().slice(0, 80).toUpperCase()
    : "DISPUTE_RESOLUTION";
  const reasonText = typeof req.body?.reasonText === "string"
    ? req.body.reasonText.trim().slice(0, 500)
    : typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";
  if (!reasonText || reasonText.length < 3) {
    res.status(400).json({ error: { message: "A written reason is required to resolve a dispute." } });
    return;
  }
  await ensureAdminAuditSchema();
  const actorId = moderator?.id ?? "admin-key";
  const actorRole = moderator?.role ?? "ADMIN";
  const idempotencyKey = String(req.header("idempotency-key") || req.body?.idempotencyKey || `DISPUTE_${resolution}:${disputeId}:${reasonCode}:${reasonText}`).slice(0, 180);
  const resolutionGuard = await pool.connect();
  try {
  await resolutionGuard.query("BEGIN");
  const advisoryKeys = [`audit:${idempotencyKey}`, `dispute:${disputeId}`].sort();
  await resolutionGuard.query(
    "SELECT pg_advisory_xact_lock(hashtext($1)), pg_advisory_xact_lock(hashtext($2))",
    advisoryKeys,
  );
  const existingAudit = await pool.query("SELECT * FROM tradigo_admin_audit_logs WHERE idempotency_key=$1", [idempotencyKey]);
  if (existingAudit.rows[0]) {
    res.json({ success: true, idempotent: true, resolution, audit: existingAudit.rows[0] });
    return;
  }
  const disputeResult = await pool.query("SELECT * FROM tradigo_disputes WHERE id=$1 AND status='OPEN'", [disputeId]);
  const dispute = disputeResult.rows[0] as Record<string, unknown> | undefined;
  if (!dispute) { res.status(409).json({ error: { message: "Open dispute not found." } }); return; }
  const session = await findSession(String(dispute.session_id));
  if (!session) { res.status(404).json({ error: { message: "Session not found." } }); return; }
  if (resolution === "REFUND" && session.payment_status === "PAYPAL_SETTLED") {
    const captureResult = await pool.query(
      "SELECT provider_reference FROM tradigo_payment_intents WHERE session_id=$1 AND kind='CAPTURE' AND provider='PAYPAL' AND provider_reference IS NOT NULL ORDER BY created_at DESC LIMIT 1",
      [session.id],
    );
    const captureId = captureResult.rows[0]?.provider_reference as string | undefined;
    if (!captureId) {
      await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
      await appendEvent(String(session.id), "moderator", "REFUND_FAILED", { reason: "PayPal capture reference is missing." });
      res.status(502).json({ error: { message: "Refund cannot be submitted because the PayPal capture reference is missing. The payout remains frozen." } });
      return;
    }
    const refund = await refundPayPalCapture(captureId, `refund:${session.id}:${disputeId}`);
    const refundReference = refund.refundId || captureId;
    await pool.query(
      `INSERT INTO tradigo_payment_intents (id,session_id,provider,provider_reference,kind,amount_cents,currency,status,idempotency_key,details)
       VALUES ($1,$2,'PAYPAL',$3,'REFUND',$4,$5,$6,$7,$8)
       ON CONFLICT (idempotency_key) DO UPDATE SET status=EXCLUDED.status, provider_reference=EXCLUDED.provider_reference, details=EXCLUDED.details`,
      [randomUUID(), session.id, refund.refundId ?? null, Number(session.final_amount_cents || 0), session.currency, refund.ok ? (refund.status === "PENDING" ? "PENDING" : "REFUNDED") : "FAILED", `refund:${session.id}:${disputeId}`, { captureId, error: refund.error }],
    );
    if (!refund.ok) {
      await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
      await appendEvent(String(session.id), "moderator", "REFUND_FAILED", { captureId, error: refund.error });
      res.status(502).json({ error: { message: "PayPal refund failed. The payout remains frozen for operator retry.", details: refund.error } });
      return;
    }
    if (refund.status === "PENDING") {
      await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_PENDING', payout_status='FROZEN', dispute_status='RESOLVED', updated_at=NOW() WHERE id=$1", [session.id]);
    } else {
      const reconciled = await reconcilePayPalEvent({ id: `refund-request:${disputeId}`, event_type: "PAYMENT.REFUNDED", resource: { id: refundReference, custom_id: session.id, status: "COMPLETED", amount: { value: (Number(session.final_amount_cents || 0) / 100).toFixed(2) } } });
      if (reconciled.status === "FAILED") {
        await pool.query("UPDATE tradigo_sessions SET payment_status='REFUND_FAILED', payout_status='FROZEN', updated_at=NOW() WHERE id=$1", [session.id]);
        res.status(502).json({ error: { message: "PayPal refund succeeded but local reconciliation failed. The payout remains frozen.", details: reconciled.error } });
        return;
      }
      await pool.query("UPDATE tradigo_sessions SET dispute_status='RESOLVED', updated_at=NOW() WHERE id=$1", [session.id]);
    }
  } else {
    await pool.query("UPDATE tradigo_sessions SET payout_status=$1, dispute_status='RESOLVED' WHERE id=$2", [resolution === "REFUND" ? "REFUNDED" : "PENDING", session.id]);
  }
  await pool.query("UPDATE tradigo_disputes SET status='RESOLVED', resolution=$1, resolved_by=$2, resolved_at=NOW() WHERE id=$3", [resolution, actorId, disputeId]);
  await appendEvent(String(session.id), actorId, "DISPUTE_RESOLVED", { resolution, reasonCode, reasonText });
  const audit = await writeAdminAudit(pool, {
    id: randomUUID(),
    actorId,
    actorRole,
    action: "DISPUTE_RESOLVED",
    targetType: "DISPUTE",
    targetId: disputeId,
    reasonCode,
    reasonText,
    idempotencyKey,
    details: { resolution, sessionId: session.id },
  });
  res.json({ success: true, resolution, idempotent: audit.idempotent, providerReference: resolution === "REFUND" ? (session.payment_status === "PAYPAL_SETTLED" ? "submitted" : null) : null, audit: audit.row });
  } finally {
    await resolutionGuard.query("COMMIT").catch(() => undefined);
    resolutionGuard.release();
  }
});

export default router;