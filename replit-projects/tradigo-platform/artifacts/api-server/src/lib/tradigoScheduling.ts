import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";

export const SCHEDULE_MINUTES_BEFORE = 15;
export const NO_SHOW_GRACE_MINUTES = 10;
export const SCHEDULE_SLOT_INCREMENT_MINUTES = 15;
export const DEFAULT_MIN_NOTICE_MINUTES = 120;
export const DEFAULT_BOOKING_HORIZON_DAYS = 30;
export const DEFAULT_BUFFER_MINUTES = 10;
export const SCHEDULING_POLICY_VERSION = "2026-08-27.education-only.v1";

export const COACHING_CATEGORIES = [
  "GENERAL_EDUCATION",
  "RISK_EDUCATION",
  "MARKET_STRUCTURE_EDUCATION",
  "TRADING_PSYCHOLOGY",
  "TRADING_JOURNAL_REVIEW",
  "HISTORICAL_TRADE_REVIEW",
] as const;

export const INSTRUMENT_CLASSES = ["GENERAL", "FOREX", "INDICES", "CRYPTO", "EQUITIES", "COMMODITIES"] as const;

let schemaReady: Promise<void> | null = null;

export async function ensureSchedulingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(`
      ALTER TABLE tradigo_coaches
        ADD COLUMN IF NOT EXISTS availability_timezone text NOT NULL DEFAULT 'UTC',
        ADD COLUMN IF NOT EXISTS availability_min_notice_minutes integer NOT NULL DEFAULT ${DEFAULT_MIN_NOTICE_MINUTES},
        ADD COLUMN IF NOT EXISTS availability_booking_horizon_days integer NOT NULL DEFAULT ${DEFAULT_BOOKING_HORIZON_DAYS},
        ADD COLUMN IF NOT EXISTS availability_buffer_minutes integer NOT NULL DEFAULT ${DEFAULT_BUFFER_MINUTES},
        ADD COLUMN IF NOT EXISTS approval_source text NOT NULL DEFAULT 'TRADIGO_MODERATION',
        ADD COLUMN IF NOT EXISTS approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
        ADD COLUMN IF NOT EXISTS identity_verification_source text;
      UPDATE tradigo_coaches
      SET approved_at = COALESCE(approved_at, updated_at),
          identity_verified_at = CASE
            WHEN verification_status IN ('IDENTITY_VERIFIED','FULLY_VERIFIED')
            THEN COALESCE(identity_verified_at, updated_at)
            ELSE identity_verified_at
          END
      WHERE approved = true;
      ALTER TABLE tradigo_sessions
        ADD COLUMN IF NOT EXISTS coaching_category text NOT NULL DEFAULT 'GENERAL_EDUCATION',
        ADD COLUMN IF NOT EXISTS instrument_class text NOT NULL DEFAULT 'GENERAL',
        ADD COLUMN IF NOT EXISTS match_group_id text,
        ADD COLUMN IF NOT EXISTS symbol text,
        ADD COLUMN IF NOT EXISTS coach_claimed_at timestamptz,
        ADD COLUMN IF NOT EXISTS coach_claim_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS trader_confirmed_at timestamptz,
        ADD COLUMN IF NOT EXISTS trader_declined_at timestamptz;
      ALTER TABLE tradigo_learning_records
        ADD COLUMN IF NOT EXISTS shared_artifact text,
        ADD COLUMN IF NOT EXISTS unresolved_questions text,
        ADD COLUMN IF NOT EXISTS trader_reflection text;
      CREATE INDEX IF NOT EXISTS tradigo_sessions_match_group_idx
        ON tradigo_sessions(match_group_id, status);
      CREATE TABLE IF NOT EXISTS tradigo_coach_availability_rules (
        id text PRIMARY KEY,
        coach_id text NOT NULL,
        weekday integer NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
        end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440 AND end_minute > start_minute),
        timezone text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (coach_id, weekday, start_minute, end_minute)
      );
      CREATE INDEX IF NOT EXISTS tradigo_coach_availability_rules_coach_idx
        ON tradigo_coach_availability_rules(coach_id, weekday, start_minute);
      CREATE TABLE IF NOT EXISTS tradigo_coach_availability_exceptions (
        id text PRIMARY KEY,
        coach_id text NOT NULL,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
        kind text NOT NULL DEFAULT 'BLACKOUT',
        note text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_coach_availability_exceptions_coach_idx
        ON tradigo_coach_availability_exceptions(coach_id, starts_at, ends_at);
      CREATE TABLE IF NOT EXISTS tradigo_coaching_policy_versions (
        id text PRIMARY KEY,
        version text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'ACTIVE',
        supported_countries text[] NOT NULL,
        allowed_categories text[] NOT NULL,
        blocked_terms text[] NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS tradigo_session_policy_decisions (
        id text PRIMARY KEY,
        session_id text NOT NULL UNIQUE,
        policy_version text NOT NULL,
        country_code text NOT NULL,
        coaching_category text NOT NULL,
        instrument_class text NOT NULL,
        decision text NOT NULL,
        reason_codes text[] NOT NULL DEFAULT '{}',
        source text NOT NULL DEFAULT 'BOOKING',
        recorded_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS tradigo_session_policy_decisions_policy_idx
        ON tradigo_session_policy_decisions(policy_version, decision, created_at);
      CREATE TABLE IF NOT EXISTS tradigo_marketplace_events (
        id text PRIMARY KEY,
        event_key text NOT NULL UNIQUE,
        event_type text NOT NULL,
        session_id text,
        actor_id text NOT NULL,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        details jsonb NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS tradigo_marketplace_events_type_time_idx
        ON tradigo_marketplace_events(event_type, occurred_at);
      CREATE INDEX IF NOT EXISTS tradigo_marketplace_events_session_time_idx
        ON tradigo_marketplace_events(session_id, occurred_at);
      CREATE TABLE IF NOT EXISTS tradigo_coach_now_availability_alerts (
        id text PRIMARY KEY,
        trader_id text NOT NULL,
        instrument_class text NOT NULL,
        topic text NOT NULL DEFAULT '',
        language text NOT NULL DEFAULT '',
        max_rate_cents integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        notified_at timestamptz
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tradigo_coach_now_alerts_route_idx
        ON tradigo_coach_now_availability_alerts(trader_id, instrument_class, topic, language);
      INSERT INTO tradigo_coaching_policy_versions
        (id, version, supported_countries, allowed_categories, blocked_terms)
      VALUES
        ('education-only-v1', '${SCHEDULING_POLICY_VERSION}',
         ARRAY['AE','AU','CA','DE','ES','FR','GB','IE','IT','JO','NL','NZ','SG','US'],
         ARRAY['${COACHING_CATEGORIES.join("','")}'],
         ARRAY['SIGNAL','BUY NOW','SELL NOW','EXECUTE','PLACE THE TRADE','ACCOUNT PASSWORD','ACCOUNT ACCESS','GUARANTEE','GUARANTEED','PROFIT','RETURN','VIP'])
      ON CONFLICT (version) DO NOTHING;
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export type AvailabilityRule = {
  id?: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone?: string;
};

export type AvailabilityException = {
  id?: string;
  startsAt: string;
  endsAt: string;
  kind?: "BLACKOUT" | "OPEN";
  note?: string;
};

export function availabilityDto(coach: Record<string, any>, rules: Record<string, any>[], exceptions: Record<string, any>[]) {
  return {
    timezone: coach.availability_timezone || "UTC",
    minNoticeMinutes: Number(coach.availability_min_notice_minutes ?? DEFAULT_MIN_NOTICE_MINUTES),
    bookingHorizonDays: Number(coach.availability_booking_horizon_days ?? DEFAULT_BOOKING_HORIZON_DAYS),
    bufferMinutes: Number(coach.availability_buffer_minutes ?? DEFAULT_BUFFER_MINUTES),
    rules: rules.map((row) => ({
      id: row.id,
      weekday: Number(row.weekday),
      startMinute: Number(row.start_minute),
      endMinute: Number(row.end_minute),
      timezone: row.timezone,
    })),
    exceptions: exceptions.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      kind: row.kind,
      note: row.note,
    })),
  };
}

export async function getAvailability(coachId: string) {
  await ensureSchedulingSchema();
  const [coach, rules, exceptions] = await Promise.all([
    pool.query("SELECT availability_timezone, availability_min_notice_minutes, availability_booking_horizon_days, availability_buffer_minutes FROM tradigo_coaches WHERE id=$1", [coachId]),
    pool.query("SELECT * FROM tradigo_coach_availability_rules WHERE coach_id=$1 ORDER BY weekday,start_minute", [coachId]),
    pool.query("SELECT * FROM tradigo_coach_availability_exceptions WHERE coach_id=$1 AND ends_at > NOW() ORDER BY starts_at", [coachId]),
  ]);
  if (!coach.rows[0]) return null;
  return availabilityDto(coach.rows[0], rules.rows, exceptions.rows);
}

function parts(date: Date, timezone: string): { year: number; month: number; day: number; weekday: number; minute: number } {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => values.find((item) => item.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: weekdays[get("weekday")] ?? 0, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

function offsetMilliseconds(date: Date, timezone: string): number {
  const value = parts(date, timezone);
  return Date.UTC(value.year, value.month - 1, value.day, Math.floor(value.minute / 60), value.minute % 60) - date.getTime();
}

function localDateToUtc(year: number, month: number, day: number, minute: number, timezone: string): Date {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minute / 60), minute % 60);
  let result = new Date(guess - offsetMilliseconds(new Date(guess), timezone));
  result = new Date(guess - offsetMilliseconds(result, timezone));
  return result;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateKey(value: string): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  return [year, month, day];
}

function addCalendarDays(key: string, amount: number): string {
  const [year, month, day] = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export type SlotCheck = { ok: true } | { ok: false; code: string; message: string };

async function availabilityContext(client: any, coachId: string) {
  const [coach, rules, exceptions] = await Promise.all([
    client.query("SELECT availability_timezone, availability_min_notice_minutes, availability_booking_horizon_days, availability_buffer_minutes, markets FROM tradigo_coaches WHERE id=$1", [coachId]),
    client.query("SELECT * FROM tradigo_coach_availability_rules WHERE coach_id=$1 ORDER BY weekday,start_minute", [coachId]),
    client.query("SELECT * FROM tradigo_coach_availability_exceptions WHERE coach_id=$1", [coachId]),
  ]);
  return { coach: coach.rows[0] as Record<string, any> | undefined, rules: rules.rows as Record<string, any>[], exceptions: exceptions.rows as Record<string, any>[] };
}

export async function checkScheduledSlot(client: any, coachId: string, start: Date, durationMinutes: number, excludeSessionId?: string): Promise<SlotCheck> {
  const context = await availabilityContext(client, coachId);
  if (!context.coach) return { ok: false, code: "COACH_NOT_FOUND", message: "This coach is no longer available." };
  const minNotice = Number(context.coach.availability_min_notice_minutes ?? DEFAULT_MIN_NOTICE_MINUTES);
  const horizon = Number(context.coach.availability_booking_horizon_days ?? DEFAULT_BOOKING_HORIZON_DAYS);
  const buffer = Number(context.coach.availability_buffer_minutes ?? DEFAULT_BUFFER_MINUTES);
  const now = Date.now();
  const startMs = start.getTime();
  const end = new Date(startMs + durationMinutes * 60_000);
  if (!Number.isFinite(startMs) || startMs <= now + minNotice * 60_000) {
    return { ok: false, code: "SCHEDULE_MIN_NOTICE", message: `Scheduled sessions require at least ${minNotice} minutes' notice.` };
  }
  if (startMs > now + horizon * 86_400_000) {
    return { ok: false, code: "SCHEDULE_HORIZON", message: `Scheduled sessions can be booked only ${horizon} days ahead.` };
  }
  if (!context.rules.length) return { ok: false, code: "COACH_NOT_AVAILABLE", message: "This coach has not opened any scheduled availability yet." };
  const timezone = String(context.coach.availability_timezone || "UTC");
  const startLocal = parts(start, timezone);
  const endLocal = parts(new Date(end.getTime() - 1), timezone);
  const fitsRule = context.rules.some((rule) =>
    Number(rule.weekday) === startLocal.weekday
    && String(rule.timezone || timezone) === timezone
    && startLocal.minute >= Number(rule.start_minute)
    && (startLocal.minute + durationMinutes) <= Number(rule.end_minute)
    && (endLocal.weekday === startLocal.weekday || Number(rule.end_minute) === 1440),
  );
  if (!fitsRule) return { ok: false, code: "OUTSIDE_AVAILABILITY", message: "That time is outside the coach's published availability." };
  const bufferedStart = new Date(startMs - buffer * 60_000);
  const bufferedEnd = new Date(end.getTime() + buffer * 60_000);
  const blackout = context.exceptions.some((exception) =>
    String(exception.kind || "BLACKOUT") === "BLACKOUT"
    && new Date(exception.starts_at).getTime() < bufferedEnd.getTime()
    && new Date(exception.ends_at).getTime() > bufferedStart.getTime(),
  );
  if (blackout) return { ok: false, code: "AVAILABILITY_EXCEPTION", message: "That time is blocked by a coach calendar exception." };
  const conflicts = await client.query(
    `SELECT 1 FROM tradigo_sessions
     WHERE coach_id=$1 AND status NOT IN ('COMPLETED','CANCELLED')
       AND scheduled_at IS NOT NULL
       AND scheduled_at < $2::timestamptz
       AND scheduled_at + (duration_minutes * interval '1 minute') > $3::timestamptz
       AND ($4::text IS NULL OR id <> $4)
     LIMIT 1`,
    [coachId, bufferedEnd.toISOString(), bufferedStart.toISOString(), excludeSessionId ?? null],
  );
  if (conflicts.rowCount) return { ok: false, code: "SCHEDULE_CONFLICT", message: "That time overlaps another coaching session or its buffer." };
  return { ok: true };
}

export async function availableSlots(coachId: string, durationMinutes: number, from: Date, to: Date) {
  await ensureSchedulingSchema();
  const client = await pool.connect();
  try {
    const context = await availabilityContext(client, coachId);
    if (!context.coach || !context.rules.length) return [];
    const timezone = String(context.coach.availability_timezone || "UTC");
    const first = parts(from, timezone);
    let key = dateKey(first.year, first.month, first.day);
    const last = parts(to, timezone);
    const lastKey = dateKey(last.year, last.month, last.day);
    const sessions = await client.query(
      `SELECT scheduled_at, duration_minutes FROM tradigo_sessions
       WHERE coach_id=$1 AND status NOT IN ('COMPLETED','CANCELLED')
         AND scheduled_at IS NOT NULL AND scheduled_at < $3 AND scheduled_at + (duration_minutes * interval '1 minute') > $2`,
      [coachId, from.toISOString(), to.toISOString()],
    );
    const result: Array<{ startsAt: string; endsAt: string; timezone: string }> = [];
    while (key <= lastKey) {
      const [year, month, day] = parseDateKey(key);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      for (const rule of context.rules.filter((item) => Number(item.weekday) === weekday)) {
        for (let minute = Number(rule.start_minute); minute + durationMinutes <= Number(rule.end_minute); minute += SCHEDULE_SLOT_INCREMENT_MINUTES) {
          const start = localDateToUtc(year, month, day, minute, timezone);
          const end = new Date(start.getTime() + durationMinutes * 60_000);
          if (start < from || start > to) continue;
          const bufferedStart = new Date(start.getTime() - Number(context.coach.availability_buffer_minutes ?? DEFAULT_BUFFER_MINUTES) * 60_000);
          const bufferedEnd = new Date(end.getTime() + Number(context.coach.availability_buffer_minutes ?? DEFAULT_BUFFER_MINUTES) * 60_000);
          const exception = context.exceptions.some((item) => String(item.kind || "BLACKOUT") === "BLACKOUT" && new Date(item.starts_at) < bufferedEnd && new Date(item.ends_at) > bufferedStart);
          const conflict = sessions.rows.some((item) => {
            const existingStart = new Date(item.scheduled_at).getTime();
            const existingEnd = existingStart + Number(item.duration_minutes) * 60_000;
            return existingStart < bufferedEnd.getTime() && existingEnd > bufferedStart.getTime();
          });
          if (!exception && !conflict && start.getTime() > Date.now() + Number(context.coach.availability_min_notice_minutes ?? DEFAULT_MIN_NOTICE_MINUTES) * 60_000) {
            result.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), timezone });
          }
        }
      }
      key = addCalendarDays(key, 1);
    }
    return result;
  } finally {
    client.release();
  }
}

const BLOCKED_ACTIVITY = /\b(signal|signals|buy now|sell now|execute|execution|place (the )?trade|account (access|password|control)|guarantee|guaranteed|profit|return[s]?|vip)\b/i;

export function containsProhibitedTradingActivity(text: string): boolean {
  return BLOCKED_ACTIVITY.test(text);
}

export type PolicyResult = {
  decision: "ALLOWED" | "DENIED";
  reasonCodes: string[];
  countryCode: string;
  coachingCategory: string;
  instrumentClass: string;
};

export async function evaluateCoachingPolicy(client: any, input: {
  traderId: string;
  coachId: string;
  category?: string;
  instrumentClass?: string;
  topic?: string;
  agenda?: string;
  learningGoal?: string;
}): Promise<PolicyResult> {
  const [user, coach] = await Promise.all([
    client.query("SELECT country_code FROM tradigo_users WHERE id=$1", [input.traderId]),
    client.query("SELECT markets FROM tradigo_coaches WHERE id=$1", [input.coachId]),
  ]);
  const countryCode = String(user.rows[0]?.country_code || "GLOBAL").trim().toUpperCase();
  const coachingCategory = String(input.category || "GENERAL_EDUCATION").trim().toUpperCase();
  const instrumentClass = String(input.instrumentClass || "GENERAL").trim().toUpperCase();
  const text = [input.topic, input.agenda, input.learningGoal].filter(Boolean).join(" ");
  const reasonCodes: string[] = [];
  if (!COACHING_CATEGORIES.includes(coachingCategory as typeof COACHING_CATEGORIES[number])) reasonCodes.push("CATEGORY_NOT_SUPPORTED");
  if (BLOCKED_ACTIVITY.test(text)) reasonCodes.push("PROHIBITED_ACTIVITY");
  const markets = (coach.rows[0]?.markets ?? []).map((value: string) => value.toUpperCase());
  if (instrumentClass !== "GENERAL" && markets.length && !markets.includes(instrumentClass)) reasonCodes.push("INSTRUMENT_NOT_SUPPORTED_BY_COACH");
  return { decision: reasonCodes.length ? "DENIED" : "ALLOWED", reasonCodes, countryCode, coachingCategory, instrumentClass };
}

export async function recordPolicyDecision(client: any, sessionId: string, actorId: string, result: PolicyResult): Promise<void> {
  await client.query(
    `INSERT INTO tradigo_session_policy_decisions
      (id,session_id,policy_version,country_code,coaching_category,instrument_class,decision,reason_codes,source,recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BOOKING',$9)
     ON CONFLICT (session_id) DO NOTHING`,
    [randomUUID(), sessionId, SCHEDULING_POLICY_VERSION, result.countryCode, result.coachingCategory, result.instrumentClass, result.decision, result.reasonCodes, actorId],
  );
}

const EVENT_MAP: Record<string, string> = {
  SESSION_REQUESTED: "REQUESTED",
  REQUEST_CREATED: "REQUESTED",
  COACH_ACCEPTED: "ACCEPTED",
  SESSION_ACCEPTED: "ACCEPTED",
  PAYMENT_AUTHORIZED: "AUTHORIZED",
  PAYMENT_AUTHORIZED_SANDBOX: "AUTHORIZED",
  PAYPAL_AUTHORIZED: "AUTHORIZED",
  ROOM_READY: "ROOM_READY",
  ATTENDANCE_JOIN: "ROOM_ENTERED",
  SESSION_STARTED: "SESSION_STARTED",
  SESSION_COMPLETED: "COMPLETED",
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  NO_SHOW_COACH: "NO_SHOW",
  NO_SHOW_TRADER: "NO_SHOW",
  NO_SHOW_MUTUAL: "NO_SHOW",
  PAYOUT_PAID: "PAYOUT_PAID",
  PAYOUT_FAILED: "PAYOUT_FAILED",
};

export const MATCH_QUALITY_EVENT_TAXONOMY = [
  "REQUESTED",
  "MATCH_CONTACTED",
  "COACH_CLAIMED",
  "COACH_ACCEPTED",
  "TRADER_CONFIRMED_COACH",
  "COACH_DECLINED",
  "TRADER_DECLINED_COACH",
  "COACH_CLAIM_EXPIRED",
  "MATCH_REMATCHED",
  "MATCH_NO_LIVE_MATCH",
  "PAYMENT_AUTHORIZATION_STARTED",
  "AUTHORIZED",
  "PAYMENT_FAILED",
  "PAYMENT_AUTHORIZATION_FAILED",
  "ROOM_READY",
  "ROOM_ENTERED",
  "ROOM_FAILED",
  "SESSION_STARTED",
  "SESSION_COMPLETED",
  "SESSION_CANCELLED",
  "NO_SHOW",
  "REFUND_COMPLETED",
  "REFUND_FAILED",
  "REVIEW_SUBMITTED",
] as const;

export const MATCH_REASON_CODES = [
  "INSTRUMENT_FIT",
  "TOPIC_FIT",
  "LANGUAGE_FIT",
  "AVAILABILITY_FIT",
  "RELIABILITY_FIT",
  "PRICE_FIT",
  "REPEAT_LEARNING_FIT",
  "LEARNER_FEEDBACK_FIT",
] as const;

const EVENT_DETAIL_KEYS = new Set([
  "mode", "matchMode", "instrumentClass", "topic", "language", "durationMinutes",
  "durationBucket", "experienceLevel", "timezoneBucket", "candidateCount",
  "availableCount", "qualifiedCount", "contactedCount", "selectedCoachCount",
  "expanded", "reasonCodes", "reasonCode", "outcome", "failureClass",
  "cancellationReasonCode", "noShowType", "source", "controlledDispatch",
  "paypalConnected", "paymentStatus", "providerStatus", "roomProvider",
  "retryable", "repeatSession", "variant", "route", "nextAction", "rating",
]);

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function privacySafeEventDetails(details: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => EVENT_DETAIL_KEYS.has(key))
      .map(([key, value]) => {
        if (key === "reasonCodes" && Array.isArray(value)) {
          return [key, value.filter((item): item is string => typeof item === "string" && MATCH_REASON_CODES.includes(item as typeof MATCH_REASON_CODES[number]))];
        }
        if (typeof value === "string") return [key, value.slice(0, 80)];
        if (typeof value === "number" || typeof value === "boolean" || value === null) return [key, value];
        return [key, Array.isArray(value) ? value.slice(0, 8) : undefined];
      })
      .filter(([, value]) => value !== undefined),
  );
}

export async function recordMarketplaceEvent(client: any, input: {
  eventType: string;
  sessionId?: string;
  actorId: string;
  details?: Record<string, unknown>;
  eventKey?: string;
  occurredAt?: Date;
}): Promise<void> {
  const eventType = EVENT_MAP[input.eventType] || input.eventType;
  if (!eventType) return;
  const details = privacySafeEventDetails(input.details ?? {});
  const fingerprint = createHash("sha256").update(stableSerialize(details)).digest("hex").slice(0, 24);
  const eventKey = input.eventKey || `${input.sessionId ?? "platform"}:${eventType}:${fingerprint}`;
  await client.query(
    `INSERT INTO tradigo_marketplace_events (id,event_key,event_type,session_id,actor_id,occurred_at,details)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7) ON CONFLICT (event_key) DO NOTHING`,
    [randomUUID(), eventKey, eventType, input.sessionId ?? null, input.actorId, input.occurredAt?.toISOString() ?? null, details],
  );
}

export async function recordMarketplaceEventFromSession(input: {
  eventType: string;
  sessionId: string;
  actorId: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await ensureSchedulingSchema();
  await recordMarketplaceEvent(pool, input);
}