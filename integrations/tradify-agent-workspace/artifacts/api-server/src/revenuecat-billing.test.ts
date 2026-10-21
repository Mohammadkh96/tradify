import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  tradifyAdminAuditEvents,
  tradifyOperationalAlertWindows,
  tradifyRevenueCatTransfers,
  tradifyUsers,
} from "@workspace/db/schema";
import app from "./app";
import { createTestAdmin } from "./test-admin";
import {
  getRevenueCatBillingState,
  isRevenueCatWebhookAuthorized,
  mapRevenueCatBillingState,
  mapRevenueCatTransferEvent,
  mapRevenueCatWebhookEvent,
  type RevenueCatBillingPayload,
  type RevenueCatProxy,
} from "./revenuecat-billing";
import {
  applyRevenueCatWebhook,
  checkRevenueCatStaleDeliveryAlert,
  evaluateRevenueCatStaleDeliveryAlert,
  PENDING_TRANSFER_RETENTION_MS,
  revenueCatBillingProvider,
  REVENUECAT_RETRY_BASE_DELAY_MS,
  REVENUECAT_STALE_DELIVERY_ALERT_KEY,
  revenueCatTransferRecovery,
} from "./routes/tradify";
import { getAdminAuditLog, getUserById, persistUser, recordAdminAudit } from "./tradify-runtime";
import {
  createRevenueCatTransferLockDiagnostics,
  withRevenueCatTransferLock,
} from "./tradify-runtime";

const expiresAt = "2026-10-01T00:00:00.000Z";
const testRunId = `${process.pid}-${Date.now()}`;
const restartTransferEventId = `missing-destination-transfer-${testRunId}`;
const expiredTransferEventId = `expired-missing-destination-transfer-${testRunId}`;
const malformedTransferEventId = `malformed-transfer-${testRunId}`;
const malformedExpiryTransferEventId = `malformed-expiry-transfer-${testRunId}`;
const emptySavedTransferEventId = `empty-saved-transfer-${testRunId}`;
const duplicateSavedTransferEventId = `duplicate-saved-transfer-${testRunId}`;
const overlappingSavedTransferEventId = `overlapping-saved-transfer-${testRunId}`;
const malformedTimestampTransferEventId = `malformed-timestamp-transfer-${testRunId}`;
const restartLifecycleEventId = `restart-lifecycle-${testRunId}`;
const restartCrossProcessTransferEventId = `restart-cross-process-transfer-${testRunId}`;
const restartCrossProcessProviderDelayMs = 120;
const malformedAuditRecordId = `malformed-transfer-audit-${testRunId}`;
const restartRequestedUserId = `billing-restart-requested-id-${testRunId}`;
const restartRequestedEmail = `billing-restart-requested-${testRunId}@example.test`;
const response = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

const fixtures: Record<string, RevenueCatBillingPayload> = {
  activePro: {
    entitlements: { items: [{ lookup_key: "pro" }] },
    subscriptions: {
      items: [
        {
          gives_access: true,
          status: "active",
          auto_renewal_status: "will_renew",
          current_period_ends_at: expiresAt,
        },
      ],
    },
  },
  activeVip: {
    entitlements: { items: [{ entitlement_identifier: "vip" }] },
    subscriptions: {
      items: [
        {
          gives_access: true,
          status: "active",
          auto_renewal_status: "active",
          expires_at: expiresAt,
        },
      ],
    },
  },
  cancelledWithAccess: {
    entitlements: { items: [{ identifier: "pro" }] },
    subscriptions: {
      items: [
        {
          gives_access: true,
          status: "active",
          auto_renewal_status: "will_not_renew",
          expires_at: expiresAt,
        },
      ],
    },
  },
  expired: {
    entitlements: { items: [] },
    subscriptions: {
      items: [
        {
          gives_access: false,
          status: "expired",
          auto_renewal_status: "will_not_renew",
          expires_at: expiresAt,
        },
      ],
    },
  },
  pastDue: {
    entitlements: { items: [{ lookup_key: "pro" }] },
    subscriptions: {
      items: [
        {
          gives_access: true,
          status: "past_due",
          auto_renewal_status: "will_not_renew",
          expires_at: expiresAt,
        },
      ],
    },
  },
  unknownEntitlement: {
    entitlements: { items: [{ lookup_key: "enterprise" }] },
    subscriptions: {
      items: [
        {
          gives_access: true,
          status: "active",
          auto_renewal_status: "will_renew",
          expires_at: expiresAt,
        },
      ],
    },
  },
  malformed: {
    entitlements: { items: [null, "pro", ["vip"], { lookup_key: "pro" }] },
    subscriptions: {
      items: [null, "active", { status: "active", auto_renewal_status: "will_renew" }],
    },
  },
};

function proxyFor(fixture: RevenueCatBillingPayload): RevenueCatProxy {
  return {
    proxy: async (_service, path) =>
      response(path.endsWith("active_entitlements") ? fixture.entitlements : fixture.subscriptions),
  };
}

function assertState(
  name: string,
  expected: { membership: string; status: string; willRenew: boolean },
) {
  const state = mapRevenueCatBillingState(fixtures[name]);
  assert.equal(state.membership, expected.membership, `${name} membership`);
  assert.equal(state.status, expected.status, `${name} status`);
  assert.equal(state.willRenew, expected.willRenew, `${name} renewal`);
}

assertState("activePro", { membership: "Pro", status: "ACTIVE", willRenew: true });
assertState("activeVip", { membership: "VIP", status: "ACTIVE", willRenew: true });
assertState("cancelledWithAccess", { membership: "Pro", status: "CANCELLED", willRenew: false });
assertState("expired", { membership: "Free", status: "EXPIRED", willRenew: false });
assertState("pastDue", { membership: "Free", status: "PAST_DUE", willRenew: false });
assertState("unknownEntitlement", { membership: "Free", status: "ACTIVE", willRenew: true });
assertState("malformed", { membership: "Free", status: "ACTIVE", willRenew: true });
assert.equal(isRevenueCatWebhookAuthorized("Bearer webhook-secret", "webhook-secret"), true);
assert.equal(isRevenueCatWebhookAuthorized("webhook-secret", "webhook-secret"), true);
assert.equal(isRevenueCatWebhookAuthorized("Bearer wrong-secret", "webhook-secret"), false);
const alertNow = Date.parse("2026-09-08T12:00:00.000Z");
const lifecycleAuditEntry = (
  minutesAgo: number,
  eventType: string,
  outcome: string,
): { createdAt: string; details: unknown } => ({
  createdAt: new Date(alertNow - minutesAgo * 60_000).toISOString(),
  details: { eventType, outcome },
});
const normalRetryNoise = evaluateRevenueCatStaleDeliveryAlert(
  [
    lifecycleAuditEntry(1, "RENEWAL", "stale"),
    lifecycleAuditEntry(2, "RENEWAL", "duplicate"),
    lifecycleAuditEntry(3, "RENEWAL", "duplicate"),
    lifecycleAuditEntry(4, "RENEWAL", "processed"),
  ],
  alertNow,
);
assert.equal(normalRetryNoise.triggered, false);
assert.equal(normalRetryNoise.staleCount, 1);
assert.deepEqual(normalRetryNoise.staleByEventType, { RENEWAL: 1 });
const boundedWindow = evaluateRevenueCatStaleDeliveryAlert(
  [
    lifecycleAuditEntry(1, "RENEWAL", "stale"),
    lifecycleAuditEntry(2, "CANCELLATION", "stale"),
    lifecycleAuditEntry(16, "EXPIRATION", "stale"),
  ],
  alertNow,
);
assert.equal(boundedWindow.triggered, false);
assert.equal(boundedWindow.staleCount, 2);
assert.deepEqual(boundedWindow.staleByEventType, { RENEWAL: 1, CANCELLATION: 1 });
const sustainedStaleDelivery = evaluateRevenueCatStaleDeliveryAlert(
  [
    lifecycleAuditEntry(1, "RENEWAL", "stale"),
    lifecycleAuditEntry(2, "RENEWAL", "stale"),
    lifecycleAuditEntry(3, "CANCELLATION", "stale"),
    lifecycleAuditEntry(4, "RENEWAL", "processed"),
  ],
  alertNow,
);
assert.equal(sustainedStaleDelivery.triggered, true);
assert.equal(sustainedStaleDelivery.staleCount, 3);
assert.deepEqual(sustainedStaleDelivery.staleByEventType, { RENEWAL: 2, CANCELLATION: 1 });
assert.equal(JSON.stringify(sustainedStaleDelivery).includes("payload"), false);
assert.equal(JSON.stringify(sustainedStaleDelivery).includes("appUserId"), false);
const persistedAlertNow = Date.parse("2026-09-08T12:00:00.000Z");
await db
  .delete(tradifyOperationalAlertWindows)
  .where(eq(tradifyOperationalAlertWindows.alertKey, REVENUECAT_STALE_DELIVERY_ALERT_KEY));
await db.insert(tradifyAdminAuditEvents).values(
  [1, 2, 3].map((index) => ({
    id: `stale-alert-audit-${testRunId}-${index}`,
    actorId: "system:revenuecat",
    actorEmail: "revenuecat-webhook",
    action: "BILLING_WEBHOOK_OUTCOME",
    details: { eventType: "RENEWAL", outcome: "stale" },
    createdAt: new Date(persistedAlertNow - index * 60_000).toISOString(),
  })),
);
const [firstAlertCheck, secondAlertCheck] = await Promise.all([
  checkRevenueCatStaleDeliveryAlert(persistedAlertNow),
  checkRevenueCatStaleDeliveryAlert(persistedAlertNow),
]);
assert.equal(firstAlertCheck.triggered, true);
assert.equal(secondAlertCheck.triggered, true);
const persistedAlertWindow = await db
  .select()
  .from(tradifyOperationalAlertWindows)
  .where(eq(tradifyOperationalAlertWindows.alertKey, REVENUECAT_STALE_DELIVERY_ALERT_KEY));
assert.equal(persistedAlertWindow.length, 1);
assert.equal(persistedAlertWindow[0]?.lastAlertAt, new Date(persistedAlertNow).toISOString());
await db
  .delete(tradifyOperationalAlertWindows)
  .where(eq(tradifyOperationalAlertWindows.alertKey, REVENUECAT_STALE_DELIVERY_ALERT_KEY));
assert.deepEqual(
  mapRevenueCatWebhookEvent({
    id: "trial-event",
    type: "INITIAL_PURCHASE",
    app_user_id: "fixture-user",
    entitlement_ids: ["pro"],
    period_type: "TRIAL",
    event_timestamp_ms: 1_000,
  }),
  {
    eventId: "trial-event",
    eventTimestampMs: 1_000,
    membership: "Pro",
    status: "TRIALING",
    expiresAt: null,
    willRenew: true,
  },
);
assert.equal(
  mapRevenueCatWebhookEvent({ id: "ignored-event", type: "TRANSFER", app_user_id: "fixture-user" }),
  null,
);
assert.deepEqual(
  mapRevenueCatTransferEvent({
    id: "transfer-event",
    type: "TRANSFER",
    app_user_id: "destination-user",
    transferred_from: ["previous-user"],
    transferred_to: ["destination-user"],
    event_timestamp_ms: 2_000,
  }),
  {
    eventId: "transfer-event",
    eventTimestampMs: 2_000,
    previousAppUserIds: ["previous-user"],
    destinationAppUserIds: ["destination-user"],
  },
);
assert.equal(
  mapRevenueCatTransferEvent({
    id: "invalid-transfer",
    type: "TRANSFER",
    transferred_from: ["previous-user"],
    transferred_to: ["destination-user", null],
  }),
  null,
);
assert.equal(
  mapRevenueCatTransferEvent({
    id: "missing-destination-id",
    type: "TRANSFER",
    transferred_from: ["previous-user"],
    transferred_to: ["destination-user"],
  }),
  null,
);
for (const [name, event] of [
  [
    "empty source list",
    {
      id: "empty-source-list",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: [],
      transferred_to: ["destination-user"],
    },
  ],
  [
    "empty destination list",
    {
      id: "empty-destination-list",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user"],
      transferred_to: [],
    },
  ],
  [
    "duplicate source ID",
    {
      id: "duplicate-source-id",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user", "previous-user"],
      transferred_to: ["destination-user", "second-destination"],
    },
  ],
  [
    "duplicate destination ID",
    {
      id: "duplicate-destination-id",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user", "second-previous"],
      transferred_to: ["destination-user", "destination-user"],
    },
  ],
  [
    "overlapping source and destination ID",
    {
      id: "overlapping-source-destination-id",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user", "destination-user"],
      transferred_to: ["destination-user", "second-destination"],
    },
  ],
  [
    "non-string source ID",
    {
      id: "non-string-source-id",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user", 42],
      transferred_to: ["destination-user", "second-destination"],
    },
  ],
  [
    "non-string destination ID",
    {
      id: "non-string-destination-id",
      type: "TRANSFER",
      app_user_id: "destination-user",
      transferred_from: ["previous-user", "second-previous"],
      transferred_to: ["destination-user", null],
    },
  ],
] as const) {
  assert.equal(mapRevenueCatTransferEvent(event), null, name);
}

const recoveryNow = Date.parse("2026-09-08T12:00:00.000Z");
const recoveryRecordedAt = "2026-09-08T11:59:00.000Z";
const recoveryTransferTimestamp = new Date(
  recoveryNow - PENDING_TRANSFER_RETENTION_MS + 1,
).toISOString();
const expiredTransferTimestamp = new Date(
  recoveryNow - PENDING_TRANSFER_RETENTION_MS,
).toISOString();

assert.deepEqual(
  revenueCatTransferRecovery(
    "failed",
    "PROVIDER_UNAVAILABLE",
    recoveryTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
  ),
  {
    recoveryState: "WAIT_FOR_PROVIDER",
    safeToRetry: false,
    escalationRequired: false,
    transferAgeMs: PENDING_TRANSFER_RETENTION_MS - 1,
    retentionState: "WITHIN_RETENTION",
    retentionExpiresAt: new Date(recoveryNow + 1).toISOString(),
    retryAttempt: null,
    retryAfter: null,
    supportGuidance:
      "Wait for the billing provider to recover, then retry through the existing delivery path. Do not change entitlements manually.",
  },
  "recent provider outages wait for provider recovery",
);
assert.deepEqual(
  revenueCatTransferRecovery(
    "failed",
    "RECONCILIATION_FAILED",
    recoveryTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
  ),
  {
    recoveryState: "RETRY_SAFE",
    safeToRetry: true,
    escalationRequired: false,
    transferAgeMs: PENDING_TRANSFER_RETENTION_MS - 1,
    retentionState: "WITHIN_RETENTION",
    retentionExpiresAt: new Date(recoveryNow + 1).toISOString(),
    retryAttempt: null,
    retryAfter: null,
    supportGuidance:
      "Retry through the existing delivery or reconciliation path while the transfer remains within retention. Do not change entitlements manually.",
  },
  "recent reconciliation failures remain safe to retry",
);
assert.deepEqual(
  revenueCatTransferRecovery(
    "failed",
    "RECONCILIATION_FAILED",
    expiredTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
  ),
  {
    recoveryState: "ESCALATE",
    safeToRetry: false,
    escalationRequired: true,
    transferAgeMs: PENDING_TRANSFER_RETENTION_MS,
    retentionState: "EXPIRED",
    retentionExpiresAt: new Date(recoveryNow).toISOString(),
    retryAttempt: null,
    retryAfter: null,
    supportGuidance:
      "The retention window has elapsed or the transfer age is unknown. Do not retry; escalate for manual review.",
  },
  "the retention boundary escalates instead of retrying",
);
const deferredRetryAfter = new Date(recoveryNow + REVENUECAT_RETRY_BASE_DELAY_MS).toISOString();
assert.deepEqual(
  revenueCatTransferRecovery(
    "failed",
    "PROVIDER_UNAVAILABLE",
    recoveryTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
    2,
    deferredRetryAfter,
  ),
  {
    recoveryState: "DEFERRED_RETRY",
    safeToRetry: false,
    escalationRequired: false,
    transferAgeMs: PENDING_TRANSFER_RETENTION_MS - 1,
    retentionState: "WITHIN_RETENTION",
    retentionExpiresAt: new Date(recoveryNow + 1).toISOString(),
    retryAttempt: 2,
    retryAfter: deferredRetryAfter,
    supportGuidance: `Retry deferred until ${deferredRetryAfter}. The existing delivery path will remain the only entitlement-changing path.`,
  },
  "recent failures are explicitly deferred during backoff",
);
assert.equal(
  revenueCatTransferRecovery(
    "failed",
    null,
    recoveryTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
  ).recoveryState,
  "ESCALATE",
  "unknown failure categories escalate",
);
assert.equal(
  revenueCatTransferRecovery(
    "processed",
    "RECONCILIATION_FAILED",
    recoveryTransferTimestamp,
    recoveryRecordedAt,
    recoveryNow,
  ).recoveryState,
  "NO_ACTION",
  "successful outcomes never receive retry guidance",
);
assert.equal(
  revenueCatTransferRecovery(
    "failed",
    "RECONCILIATION_FAILED",
    "not-a-date",
    "also-not-a-date",
    recoveryNow,
  ).recoveryState,
  "ESCALATE",
  "unknown transfer age escalates",
);

const previousProjectId = process.env.REVENUECAT_PROJECT_ID;
const previousWebhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
process.env.REVENUECAT_PROJECT_ID = "billing-fixture-project";
process.env.REVENUECAT_WEBHOOK_SECRET = "billing-webhook-secret";
try {
  const fetched = await getRevenueCatBillingState("fixture-user", proxyFor(fixtures.activeVip));
  assert.deepEqual(fetched, { membership: "VIP", status: "ACTIVE", expiresAt, willRenew: true });

  const missingCustomer = await getRevenueCatBillingState("missing-user", {
    proxy: async () => response({ error: "customer not found" }, 404),
  });
  assert.deepEqual(missingCustomer, {
    membership: "Free",
    status: "INACTIVE",
    expiresAt: null,
    willRenew: false,
  });

  await assert.rejects(
    () =>
      getRevenueCatBillingState("provider-error-user", {
        proxy: async () => response({ error: "provider unavailable" }, 503),
      }),
    /RevenueCat verification failed \(503\/503\)/,
  );
} finally {
  if (previousProjectId === undefined) delete process.env.REVENUECAT_PROJECT_ID;
  else process.env.REVENUECAT_PROJECT_ID = previousProjectId;
}

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const email = `billing-route-${process.pid}@example.test`;
let serverClosed = false;

async function closeServer() {
  if (serverClosed) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  serverClosed = true;
}

async function request(path: string, init?: RequestInit) {
  const result = await fetch(`${baseUrl}${path}`, init);
  return { status: result.status, body: (await result.json()) as Record<string, unknown> };
}

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

async function startRegistrationCollisionWorker(): Promise<{
  child: ReturnType<typeof spawn>;
  baseUrl: string;
}> {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          "../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs",
          import.meta.url,
        ),
      ),
      fileURLToPath(new URL("./revenuecat-billing.restart-probe.ts", import.meta.url)),
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, BILLING_REGISTRATION_COLLISION_WORKER: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out starting registration collision worker:\n${output}`)),
      30_000,
    );
    const onOutput = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/BILLING_REGISTRATION_COLLISION_READY:(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    };
    child.stdout.on("data", onOutput);
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (code !== null || signal !== null) {
        clearTimeout(timeout);
        reject(
          new Error(
            `registration collision worker exited before readiness (${code ?? signal}):\n${output}`,
          ),
        );
      }
    });
  });
  return { child, baseUrl: `http://127.0.0.1:${port}/api` };
}

const originalProvider = revenueCatBillingProvider.get;
try {
  const lockStarted = deferred();
  const lockRelease = deferred();
  const lockOrder: string[] = [];
  const firstLockDiagnostics = createRevenueCatTransferLockDiagnostics([
    "cross-instance-source",
    "cross-instance-destination",
  ]);
  const secondLockDiagnostics = createRevenueCatTransferLockDiagnostics([
    "cross-instance-destination",
    "cross-instance-source",
  ]);
  const firstInstanceTransfer = withRevenueCatTransferLock(
    ["cross-instance-source", "cross-instance-destination"],
    async () => {
      lockStarted.resolve();
      await lockRelease.promise;
      lockOrder.push("first");
    },
    firstLockDiagnostics,
  );
  await lockStarted.promise;
  const secondInstanceTransfer = withRevenueCatTransferLock(
    ["cross-instance-destination", "cross-instance-source"],
    async () => {
      lockOrder.push("second");
    },
    secondLockDiagnostics,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(lockOrder, []);
  lockRelease.resolve();
  await Promise.all([firstInstanceTransfer, secondInstanceTransfer]);
  assert.deepEqual(lockOrder, ["first", "second"]);
  assert.equal(firstLockDiagnostics.participantCount, 2);
  assert.equal(firstLockDiagnostics.outcome, "ACQUIRED");
  assert.equal(secondLockDiagnostics.participantCount, 2);
  assert.ok(["ACQUIRED", "WAITED"].includes(secondLockDiagnostics.outcome));
  assert.equal(Number.isFinite(secondLockDiagnostics.waitMs), true);

  const auth = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "billing-pass" }),
  });
  assert.equal(auth.status, 201);
  const token = String(auth.body.token);
  const authorization = { authorization: `Bearer ${token}` };
  const restartRequested = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: restartRequestedEmail,
      password: "billing-pass",
      userId: restartRequestedUserId,
    }),
  });
  assert.equal(restartRequested.status, 201);
  assert.equal((restartRequested.body.user as Record<string, unknown>).id, restartRequestedUserId);
  const requestedUserIdCases: Array<[string, unknown]> = [
    ["empty", ""],
    ["whitespace", "   "],
    ["non-string", 42],
    ["too-long", "a".repeat(256)],
    ["control-character", "destination\u0000account"],
    ["internal-whitespace", "destination account"],
  ];
  for (const [label, userId] of requestedUserIdCases) {
    const requestedUserEmail = `billing-requested-id-${label}-${testRunId}@example.test`;
    const rejected = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: requestedUserEmail, password: "billing-pass", userId }),
    });
    assert.equal(rejected.status, 400, label);
    assert.equal(rejected.body.error, "INVALID_USER_ID", label);

    const registeredWithoutRequestedId = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: requestedUserEmail, password: "billing-pass" }),
    });
    assert.equal(registeredWithoutRequestedId.status, 201, label);
  }
  const collisionEmail = `billing-requested-id-collision-${testRunId}@example.test`;
  const collision = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: collisionEmail,
      password: "billing-pass",
      userId: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    }),
  });
  assert.equal(collision.status, 409);
  assert.equal(collision.body.error, "USER_ID_IN_USE");
  const collisionWithoutRequestedId = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: collisionEmail, password: "billing-pass" }),
  });
  assert.equal(collisionWithoutRequestedId.status, 201);
  const concurrentDestinationId = `billing-concurrent-destination-${testRunId}`;
  const concurrentWorkers = await Promise.all([
    startRegistrationCollisionWorker(),
    startRegistrationCollisionWorker(),
  ]);
  try {
    const concurrentResults = await Promise.all(
      concurrentWorkers.map(({ baseUrl }, index) =>
        fetch(`${baseUrl}/auth/register`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: `billing-concurrent-${index}-${testRunId}@example.test`,
            password: "billing-pass",
            userId: concurrentDestinationId,
          }),
        }).then(async (response) => ({
          status: response.status,
          body: (await response.json()) as Record<string, unknown>,
        })),
      ),
    );
    assert.deepEqual(
      concurrentResults.map((result) => result.status).sort((a, b) => a - b),
      [201, 409],
    );
    assert.equal(
      concurrentResults.filter((result) => result.body.error === "USER_ID_IN_USE").length,
      1,
    );
    const persistedConcurrentDestination = await db
      .select({ id: tradifyUsers.id })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.id, concurrentDestinationId));
    assert.deepEqual(persistedConcurrentDestination, [{ id: concurrentDestinationId }]);
  } finally {
    await Promise.all(
      concurrentWorkers.map(
        ({ child }) =>
          new Promise<void>((resolve) => {
            child.once("close", () => resolve());
            child.kill("SIGTERM");
          }),
      ),
    );
  }

  const before = await request("/membership/status", { headers: authorization });
  assert.equal(before.status, 200);
  assert.equal(before.body.membership, "Free");

  const unconfirmedUpgrade = await request("/membership/upgrade", {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ membership: "VIP" }),
  });
  assert.equal(unconfirmedUpgrade.status, 409);
  assert.equal(unconfirmedUpgrade.body.error, "BILLING_CHECKOUT_REQUIRED");
  const afterUnconfirmedUpgrade = await request("/membership/status", { headers: authorization });
  assert.equal(afterUnconfirmedUpgrade.body.membership, "Free");
  assert.deepEqual(afterUnconfirmedUpgrade.body.entitlements, []);

  revenueCatBillingProvider.get = async () => mapRevenueCatBillingState(fixtures.activePro);
  const synced = await request("/membership/sync", { method: "POST", headers: authorization });
  assert.equal(synced.status, 200);
  assert.equal(synced.body.membership, "Pro");
  assert.deepEqual(synced.body.entitlements, [
    "REALTIME_SIGNALS",
    "DGV8_CHART_LEVELS",
    "UNLIMITED_ALERTS",
  ]);

  const authoritative = await request("/membership/status", { headers: authorization });
  assert.equal(authoritative.status, 200);
  assert.equal(authoritative.body.membership, "Pro");
  assert.equal(authoritative.body.billingStatus, "ACTIVE");

  revenueCatBillingProvider.get = async () => {
    throw new Error("provider disconnected");
  };
  const failedSync = await request("/membership/sync", { method: "POST", headers: authorization });
  assert.equal(failedSync.status, 503);
  assert.equal(failedSync.body.error, "BILLING_VERIFICATION_UNAVAILABLE");

  const afterFailure = await request("/membership/status", { headers: authorization });
  assert.equal(afterFailure.body.membership, "Pro");
  assert.equal(afterFailure.body.billingStatus, "ACTIVE");

  const webhook = (event: Record<string, unknown>, auth = "Bearer billing-webhook-secret") =>
    request("/billing/revenuecat/webhook", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
  const billingUserId = String((auth.body.user as Record<string, unknown>).id);
  const overriddenUser = getUserById(billingUserId);
  assert.ok(overriddenUser);
  overriddenUser.profile.membership = "VIP";
  overriddenUser.membershipSource = "ADMIN_OVERRIDE";
  overriddenUser.overrideEndsAt = new Date(Date.now() + 60_000).toISOString();
  overriddenUser.subscriptionStatus = "ACTIVE";
  overriddenUser.entitlements = [...(authoritative.body.entitlements as string[])];
  await persistUser(overriddenUser, overriddenUser.version);

  let providerReadsDuringOverride = 0;
  revenueCatBillingProvider.get = async () => {
    providerReadsDuringOverride += 1;
    return mapRevenueCatBillingState(fixtures.expired);
  };
  const protectedSync = await request("/membership/sync", {
    method: "POST",
    headers: authorization,
  });
  assert.equal(protectedSync.status, 200);
  assert.equal(protectedSync.body.membership, "VIP");
  assert.equal(protectedSync.body.source, "ADMIN_OVERRIDE");
  assert.equal(
    providerReadsDuringOverride,
    0,
    "active administrator membership decisions are not overwritten by provider sync",
  );

  const overrideRenewal = await webhook({
    id: `admin-override-renewal-${testRunId}`,
    type: "RENEWAL",
    app_user_id: billingUserId,
    entitlement_ids: ["pro"],
    event_timestamp_ms: Date.now() + 10_000,
    expiration_at_ms: Date.now() + 86_400_000,
  });
  assert.equal(overrideRenewal.body.result, "processed");
  const protectedAfterWebhook = await request("/membership/status", { headers: authorization });
  assert.equal(protectedAfterWebhook.body.membership, "VIP");
  assert.equal(protectedAfterWebhook.body.source, "ADMIN_OVERRIDE");

  const overrideAdmin = await createTestAdmin(baseUrl);
  const overrideAdminHeaders = {
    authorization: `Bearer ${overrideAdmin.token}`,
    "content-type": "application/json",
  };
  const beforeRestore = await request(`/admin/crm/users/${billingUserId}`, {
    headers: overrideAdminHeaders,
  });
  assert.equal(beforeRestore.status, 200);
  revenueCatBillingProvider.get = async () => mapRevenueCatBillingState(fixtures.activePro);
  const restoredToProvider = await request(`/admin/crm/users/${billingUserId}/membership`, {
    method: "PATCH",
    headers: overrideAdminHeaders,
    body: JSON.stringify({
      membership: "VIP",
      clearOverride: true,
      reason: "Restore verified provider authority",
      version: (beforeRestore.body as { version: number }).version,
    }),
  });
  assert.equal(restoredToProvider.status, 200);
  assert.equal((restoredToProvider.body.user as { membership: string }).membership, "Pro");
  assert.equal(
    (restoredToProvider.body.user as { membershipSource: string }).membershipSource,
    "REVENUECAT",
  );

  const expiredOverrideUser = getUserById(billingUserId);
  assert.ok(expiredOverrideUser);
  expiredOverrideUser.profile.membership = "VIP";
  expiredOverrideUser.membershipSource = "ADMIN_OVERRIDE";
  expiredOverrideUser.overrideEndsAt = new Date(Date.now() - 1_000).toISOString();
  expiredOverrideUser.trialEndsAt = null;
  expiredOverrideUser.subscriptionStatus = "ACTIVE";
  expiredOverrideUser.entitlements = [...(authoritative.body.entitlements as string[])];
  await persistUser(expiredOverrideUser, expiredOverrideUser.version);
  revenueCatBillingProvider.get = async () => {
    throw new Error("billing provider unavailable");
  };
  const expiredOverrideSync = await request("/membership/sync", {
    method: "POST",
    headers: authorization,
  });
  assert.equal(expiredOverrideSync.status, 503);
  const expiredOverrideStatus = await request("/membership/status", { headers: authorization });
  assert.equal(expiredOverrideStatus.status, 200);
  assert.equal(expiredOverrideStatus.body.membership, "Free");
  assert.equal(expiredOverrideStatus.body.source, "UNKNOWN");
  assert.deepEqual(expiredOverrideStatus.body.entitlements, []);
  revenueCatBillingProvider.get = async () => mapRevenueCatBillingState(fixtures.activePro);
  const recoveredExpiredOverride = await request("/membership/sync", {
    method: "POST",
    headers: authorization,
  });
  assert.equal(recoveredExpiredOverride.status, 200);
  assert.equal(recoveredExpiredOverride.body.membership, "Pro");
  assert.equal(recoveredExpiredOverride.body.source, "REVENUECAT");

  let billingRegistrationSequence = 0;
  const registerBillingUser = async (label: string) => {
    const registered = await request("/auth/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // This suite creates more accounts than the per-IP signup safety limit.
        "x-forwarded-for": `198.51.100.${++billingRegistrationSequence}`,
      },
      body: JSON.stringify({
        email: `billing-transfer-${label}-${process.pid}-${Date.now()}@example.test`,
        password: "billing-pass",
      }),
    });
    assert.equal(registered.status, 201);
    return {
      id: String(registered.body.user && (registered.body.user as Record<string, unknown>).id),
      token: String(registered.body.token),
    };
  };
  const membership = (token: string) =>
    request("/membership/status", {
      headers: { authorization: `Bearer ${token}` },
    });

  const unauthorizedWebhook = await webhook(
    {
      id: "unauthorized-event",
      type: "EXPIRATION",
      app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
      event_timestamp_ms: 1_000,
    },
    "Bearer wrong-secret",
  );
  assert.equal(unauthorizedWebhook.status, 401);
  assert.equal(unauthorizedWebhook.body.error, "BILLING_WEBHOOK_UNAUTHORIZED");
  assert.equal(typeof unauthorizedWebhook.body.message, "string");
  assert.equal(typeof unauthorizedWebhook.body.requestId, "number");

  const unauthorizedReconciliation = await request("/billing/revenuecat/reconcile", {
    method: "POST",
  });
  assert.equal(unauthorizedReconciliation.status, 401);
  assert.equal(unauthorizedReconciliation.body.error, "AUTH_REQUIRED");
  assert.equal(typeof unauthorizedReconciliation.body.message, "string");
  assert.equal(typeof unauthorizedReconciliation.body.requestId, "number");

  const lifecycleEventBase = Date.now() + 20_000;
  const cancellation = await webhook({
    id: "cancellation-event",
    type: "CANCELLATION",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    entitlement_ids: ["pro"],
    event_timestamp_ms: lifecycleEventBase + 2_000,
    expiration_at_ms: Date.parse("2026-11-01T00:00:00.000Z"),
  });
  assert.equal(cancellation.status, 200);
  assert.equal(cancellation.body.result, "processed");
  const cancelled = await request("/membership/status", { headers: authorization });
  assert.equal(cancelled.body.membership, "Pro");
  assert.equal(cancelled.body.billingStatus, "CANCELLED");
  assert.equal(cancelled.body.willRenew, false);
  assert.equal(cancelled.body.expiresAt, "2026-11-01T00:00:00.000Z");

  const duplicate = await webhook({
    id: "cancellation-event",
    type: "CANCELLATION",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    entitlement_ids: ["pro"],
    event_timestamp_ms: lifecycleEventBase + 2_000,
    expiration_at_ms: Date.parse("2026-11-01T00:00:00.000Z"),
  });
  assert.equal(duplicate.body.result, "duplicate");

  const staleRenewal = await webhook({
    id: "stale-renewal-event",
    type: "RENEWAL",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    entitlement_ids: ["pro"],
    event_timestamp_ms: lifecycleEventBase + 1_500,
  });
  assert.equal(staleRenewal.body.result, "stale");
  const stillCancelled = await request("/membership/status", { headers: authorization });
  assert.equal(stillCancelled.body.billingStatus, "CANCELLED");

  const lifecycleAuditEntries = await getAdminAuditLog({
    action: "BILLING_WEBHOOK_OUTCOME",
    pageSize: 20,
  });
  const lifecycleOutcomes = lifecycleAuditEntries
    .map((entry) => entry.details)
    .filter((details) => details.eventType === "CANCELLATION" || details.eventType === "RENEWAL")
    .slice(0, 3)
    .sort((left, right) => String(left.outcome).localeCompare(String(right.outcome)));
  assert.deepEqual(
    lifecycleOutcomes.map((details) => details.outcome),
    ["duplicate", "processed", "stale"],
  );
  for (const details of lifecycleOutcomes) {
    assert.deepEqual(Object.keys(details).sort(), ["eventType", "outcome"]);
    assert.equal("eventId" in details, false);
    assert.equal("appUserId" in details, false);
    assert.equal("payload" in details, false);
  }

  const renewal = await webhook({
    id: "renewal-event",
    type: "RENEWAL",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    entitlement_ids: ["pro"],
    event_timestamp_ms: lifecycleEventBase + 3_000,
    expiration_at_ms: Date.parse("2026-12-01T00:00:00.000Z"),
  });
  assert.equal(renewal.body.result, "processed");
  const renewed = await request("/membership/status", { headers: authorization });
  assert.equal(renewed.body.membership, "Pro");
  assert.equal(renewed.body.billingStatus, "ACTIVE");
  assert.equal(renewed.body.willRenew, true);

  const paymentFailure = await webhook({
    id: "billing-issue-event",
    type: "BILLING_ISSUE",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    entitlement_ids: ["pro"],
    event_timestamp_ms: lifecycleEventBase + 4_000,
  });
  assert.equal(paymentFailure.body.result, "processed");
  const pastDue = await request("/membership/status", { headers: authorization });
  assert.equal(pastDue.body.membership, "Free");
  assert.equal(pastDue.body.billingStatus, "PAST_DUE");
  assert.equal(pastDue.body.expiresAt, null);
  assert.deepEqual(pastDue.body.entitlements, []);

  const expiration = await webhook({
    id: "expiration-event",
    type: "EXPIRATION",
    app_user_id: String(auth.body.user && (auth.body.user as Record<string, unknown>).id),
    event_timestamp_ms: lifecycleEventBase + 5_000,
    expiration_at_ms: Date.parse("2026-12-15T00:00:00.000Z"),
  });
  assert.equal(expiration.body.result, "processed");
  const expired = await request("/membership/status", { headers: authorization });
  assert.equal(expired.body.membership, "Free");
  assert.equal(expired.body.billingStatus, "EXPIRED");
  assert.equal(expired.body.expiresAt, "2026-12-15T00:00:00.000Z");
  assert.equal(expired.body.willRenew, false);

  const destinationEmail = `billing-transfer-destination-${process.pid}@example.test`;
  const destinationAuth = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: destinationEmail, password: "billing-pass" }),
  });
  assert.equal(destinationAuth.status, 201);
  const destinationId = String(
    destinationAuth.body.user && (destinationAuth.body.user as Record<string, unknown>).id,
  );
  const sourceId = String(auth.body.user && (auth.body.user as Record<string, unknown>).id);
  const malformedTransferCases = [
    {
      name: "empty source list",
      id: `empty-source-list-${testRunId}`,
      transferred_from: [],
      transferred_to: [destinationId],
    },
    {
      name: "empty destination list",
      id: `empty-destination-list-${testRunId}`,
      transferred_from: [sourceId],
      transferred_to: [],
    },
    {
      name: "duplicate source ID",
      id: `duplicate-source-id-${testRunId}`,
      transferred_from: [sourceId, sourceId],
      transferred_to: [destinationId, "second-destination"],
    },
    {
      name: "duplicate destination ID",
      id: `duplicate-destination-id-${testRunId}`,
      transferred_from: [sourceId, "second-source"],
      transferred_to: [destinationId, destinationId],
    },
    {
      name: "overlapping source and destination ID",
      id: `overlapping-source-destination-id-${testRunId}`,
      transferred_from: [sourceId, destinationId],
      transferred_to: [destinationId, "second-destination"],
    },
    {
      name: "non-string source ID",
      id: `non-string-source-id-${testRunId}`,
      transferred_from: [sourceId, 42],
      transferred_to: [destinationId, "second-destination"],
    },
    {
      name: "non-string destination ID",
      id: `non-string-destination-id-${testRunId}`,
      transferred_from: [sourceId, "second-source"],
      transferred_to: [destinationId, null],
    },
  ] as const;
  const sourceBeforeMalformed = await membership(token);
  const destinationBeforeMalformed = await membership(String(destinationAuth.body.token));
  for (const malformedTransfer of malformedTransferCases) {
    const rejected = await webhook({
      ...malformedTransfer,
      app_user_id: destinationId,
      type: "TRANSFER",
    });
    assert.equal(rejected.status, 400, malformedTransfer.name);
    assert.equal(rejected.body.error, "INVALID_BILLING_WEBHOOK", malformedTransfer.name);
    const pendingRows = await db
      .select({ eventId: tradifyRevenueCatTransfers.eventId })
      .from(tradifyRevenueCatTransfers)
      .where(eq(tradifyRevenueCatTransfers.eventId, malformedTransfer.id));
    assert.deepEqual(pendingRows, [], malformedTransfer.name);
  }
  assert.equal((await membership(token)).body.membership, sourceBeforeMalformed.body.membership);
  assert.equal(
    (await membership(token)).body.billingStatus,
    sourceBeforeMalformed.body.billingStatus,
  );
  assert.equal(
    (await membership(String(destinationAuth.body.token))).body.membership,
    destinationBeforeMalformed.body.membership,
  );
  assert.equal(
    (await membership(String(destinationAuth.body.token))).body.billingStatus,
    destinationBeforeMalformed.body.billingStatus,
  );
  let transferLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    transferLookups += 1;
    assert.equal(appUserId, destinationId);
    return mapRevenueCatBillingState(fixtures.activeVip);
  };

  const transferEvent = {
    id: "transfer-event",
    type: "TRANSFER",
    app_user_id: destinationId,
    transferred_from: [String(auth.body.user && (auth.body.user as Record<string, unknown>).id)],
    transferred_to: [destinationId],
    event_timestamp_ms: lifecycleEventBase + 6_000,
  };
  const transfer = await webhook(transferEvent);
  assert.equal(transfer.status, 200);
  assert.equal(transfer.body.result, "processed");
  const transferredSource = await request("/membership/status", { headers: authorization });
  assert.equal(transferredSource.body.membership, "Free");
  assert.equal(transferredSource.body.billingStatus, "EXPIRED");
  assert.deepEqual(transferredSource.body.entitlements, []);
  const transferredDestination = await request("/membership/status", {
    headers: { authorization: `Bearer ${String(destinationAuth.body.token)}` },
  });
  assert.equal(transferredDestination.body.membership, "VIP");
  assert.equal(transferredDestination.body.billingStatus, "ACTIVE");
  assert.deepEqual(transferredDestination.body.entitlements, [
    "REALTIME_SIGNALS",
    "DGV8_CHART_LEVELS",
    "UNLIMITED_ALERTS",
  ]);

  const duplicateTransfer = await webhook(transferEvent);
  assert.equal(duplicateTransfer.body.result, "duplicate");
  assert.equal(transferLookups, 1);

  const racingSource = await registerBillingUser("lifecycle-racing-source");
  const racingDestination = await registerBillingUser("lifecycle-racing-destination");
  const transferReconciliationStarted = deferred();
  const transferReconciliationRelease = deferred();
  revenueCatBillingProvider.get = async (appUserId) => {
    assert.equal(appUserId, racingDestination.id);
    transferReconciliationStarted.resolve();
    await transferReconciliationRelease.promise;
    return mapRevenueCatBillingState(fixtures.activeVip);
  };
  const newerRacingTransfer = webhook({
    id: "lifecycle-racing-newer-transfer",
    type: "TRANSFER",
    app_user_id: racingDestination.id,
    transferred_from: [racingSource.id],
    transferred_to: [racingDestination.id],
    event_timestamp_ms: 80_000,
  });
  await transferReconciliationStarted.promise;
  const olderRacingLifecycle = applyRevenueCatWebhook({
    id: "lifecycle-racing-older-lifecycle",
    type: "EXPIRATION",
    app_user_id: racingDestination.id,
    event_timestamp_ms: 70_000,
    expiration_at_ms: Date.parse("2026-09-01T00:00:00.000Z"),
  });
  transferReconciliationRelease.resolve();
  const [racingTransferResult, racingLifecycleResult] = await Promise.all([
    newerRacingTransfer,
    olderRacingLifecycle,
  ]);
  assert.equal(racingTransferResult.body.result, "processed");
  assert.equal(racingLifecycleResult, "stale");
  const racingDestinationState = await membership(racingDestination.token);
  assert.equal(racingDestinationState.body.membership, "VIP");
  assert.equal(racingDestinationState.body.billingStatus, "ACTIVE");
  assert.equal(racingDestinationState.body.expiresAt, expiresAt);

  const missingTimestampLifecycle = await applyRevenueCatWebhook({
    id: `lifecycle-no-timestamp-${testRunId}`,
    type: "EXPIRATION",
    app_user_id: racingDestination.id,
    expiration_at_ms: Date.parse("2026-09-01T00:00:00.000Z"),
  });
  assert.equal(missingTimestampLifecycle, "ignored");
  const unchangedRacingDestination = await membership(racingDestination.token);
  assert.equal(unchangedRacingDestination.body.membership, "VIP");
  assert.equal(unchangedRacingDestination.body.billingStatus, "ACTIVE");

  const sharedSource = await registerBillingUser("shared-source");
  const sharedSourceDestination = await registerBillingUser("shared-source-destination");
  const sharedSourceOlderDestination = await registerBillingUser("shared-source-older-destination");
  const sourceTransferStarted = deferred();
  const sourceTransferRelease = deferred();
  let sharedSourceLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    sharedSourceLookups += 1;
    if (appUserId === sharedSourceDestination.id) {
      sourceTransferStarted.resolve();
      await sourceTransferRelease.promise;
      return mapRevenueCatBillingState(fixtures.activePro);
    }
    assert.equal(appUserId, sharedSourceOlderDestination.id);
    return mapRevenueCatBillingState(fixtures.activeVip);
  };

  const newerSharedSourceTransfer = webhook({
    id: "shared-source-newer-transfer",
    type: "TRANSFER",
    app_user_id: sharedSourceDestination.id,
    transferred_from: [sharedSource.id],
    transferred_to: [sharedSourceDestination.id],
    event_timestamp_ms: 20_000,
  });
  await sourceTransferStarted.promise;
  const olderSharedSourceTransfer = webhook({
    id: "shared-source-older-transfer",
    type: "TRANSFER",
    app_user_id: sharedSourceOlderDestination.id,
    transferred_from: [sharedSource.id],
    transferred_to: [sharedSourceOlderDestination.id],
    event_timestamp_ms: 10_000,
  });
  sourceTransferRelease.resolve();
  const [newerSharedSourceResult, olderSharedSourceResult] = await Promise.all([
    newerSharedSourceTransfer,
    olderSharedSourceTransfer,
  ]);
  assert.equal(newerSharedSourceResult.body.result, "processed");
  assert.equal(olderSharedSourceResult.body.result, "stale");
  assert.equal(sharedSourceLookups, 1);
  const sharedSourceState = await membership(sharedSource.token);
  assert.equal(sharedSourceState.body.membership, "Free");
  assert.equal(sharedSourceState.body.billingStatus, "EXPIRED");
  const newerSharedSourceState = await membership(sharedSourceDestination.token);
  assert.equal(newerSharedSourceState.body.membership, "Pro");
  const olderSharedSourceState = await membership(sharedSourceOlderDestination.token);
  assert.equal(olderSharedSourceState.body.membership, "Free");

  const sharedDestination = await registerBillingUser("shared-destination");
  const sharedDestinationSource = await registerBillingUser("shared-destination-source");
  const sharedDestinationNewerSource = await registerBillingUser("shared-destination-newer-source");
  const destinationTransferStarted = deferred();
  const destinationTransferRelease = deferred();
  let sharedDestinationLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    assert.equal(appUserId, sharedDestination.id);
    sharedDestinationLookups += 1;
    if (sharedDestinationLookups === 1) {
      destinationTransferStarted.resolve();
      await destinationTransferRelease.promise;
      return mapRevenueCatBillingState(fixtures.activePro);
    }
    return mapRevenueCatBillingState(fixtures.activeVip);
  };

  const olderSharedDestinationTransfer = webhook({
    id: "shared-destination-older-transfer",
    type: "TRANSFER",
    app_user_id: sharedDestination.id,
    transferred_from: [sharedDestinationSource.id],
    transferred_to: [sharedDestination.id],
    event_timestamp_ms: 30_000,
  });
  await destinationTransferStarted.promise;
  const newerSharedDestinationTransfer = webhook({
    id: "shared-destination-newer-transfer",
    type: "TRANSFER",
    app_user_id: sharedDestination.id,
    transferred_from: [sharedDestinationNewerSource.id],
    transferred_to: [sharedDestination.id],
    event_timestamp_ms: 40_000,
  });
  destinationTransferRelease.resolve();
  const [olderSharedDestinationResult, newerSharedDestinationResult] = await Promise.all([
    olderSharedDestinationTransfer,
    newerSharedDestinationTransfer,
  ]);
  assert.equal(olderSharedDestinationResult.body.result, "processed");
  assert.equal(newerSharedDestinationResult.body.result, "processed");
  assert.equal(sharedDestinationLookups, 2);
  const sharedDestinationState = await membership(sharedDestination.token);
  assert.equal(sharedDestinationState.body.membership, "VIP");
  assert.equal(sharedDestinationState.body.billingStatus, "ACTIVE");
  assert.equal(sharedDestinationState.body.expiresAt, expiresAt);
  assert.equal((await membership(sharedDestinationSource.token)).body.membership, "Free");
  assert.equal((await membership(sharedDestinationNewerSource.token)).body.membership, "Free");

  const staleSharedDestinationReplay = await webhook({
    id: "shared-destination-stale-replay",
    type: "TRANSFER",
    app_user_id: sharedDestination.id,
    transferred_from: [sharedDestinationSource.id],
    transferred_to: [sharedDestination.id],
    event_timestamp_ms: 30_000,
  });
  assert.equal(staleSharedDestinationReplay.body.result, "stale");
  assert.equal(sharedDestinationLookups, 2);
  const afterStaleSharedDestinationReplay = await membership(sharedDestination.token);
  assert.equal(afterStaleSharedDestinationReplay.body.membership, "VIP");
  assert.equal(afterStaleSharedDestinationReplay.body.billingStatus, "ACTIVE");

  const transientSource = await registerBillingUser("transient-source");
  const transientDestination = await registerBillingUser("transient-destination");
  const sourcePurchase = await webhook({
    id: "transient-source-purchase",
    type: "INITIAL_PURCHASE",
    app_user_id: transientSource.id,
    entitlement_ids: ["vip"],
    event_timestamp_ms: 50_000,
  });
  assert.equal(sourcePurchase.body.result, "processed");
  const destinationPurchase = await webhook({
    id: "transient-destination-purchase",
    type: "INITIAL_PURCHASE",
    app_user_id: transientDestination.id,
    entitlement_ids: ["pro"],
    event_timestamp_ms: 51_000,
  });
  assert.equal(destinationPurchase.body.result, "processed");
  let transientTransferLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    assert.equal(appUserId, transientDestination.id);
    transientTransferLookups += 1;
    if (transientTransferLookups === 1) {
      return { membership: "Free", status: "UNAVAILABLE", expiresAt: null, willRenew: false };
    }
    return mapRevenueCatBillingState(fixtures.activeVip);
  };
  const transientTransfer = {
    id: `transient-provider-transfer-${testRunId}`,
    type: "TRANSFER",
    app_user_id: transientDestination.id,
    transferred_from: [transientSource.id],
    transferred_to: [transientDestination.id],
    event_timestamp_ms: 52_000,
  };
  const unavailableTransfer = await webhook(transientTransfer);
  assert.equal(unavailableTransfer.status, 503);
  assert.equal(unavailableTransfer.body.error, "BILLING_WEBHOOK_RETRY");
  assert.equal(typeof unavailableTransfer.body.message, "string");
  assert.equal(typeof unavailableTransfer.body.requestId, "number");
  assert.equal(transientTransferLookups, 1);
  const sourceDuringOutage = await membership(transientSource.token);
  assert.equal(sourceDuringOutage.body.membership, "VIP");
  assert.equal(sourceDuringOutage.body.billingStatus, "ACTIVE");
  const destinationDuringOutage = await membership(transientDestination.token);
  assert.equal(destinationDuringOutage.body.membership, "Pro");
  assert.equal(destinationDuringOutage.body.billingStatus, "ACTIVE");

  const retriedTransfer = await webhook(transientTransfer);
  assert.equal(retriedTransfer.status, 200);
  assert.equal(retriedTransfer.body.result, "deferred");
  assert.equal(transientTransferLookups, 1);
  const transientFailureAudit = (
    await getAdminAuditLog({
      actorId: "system:revenuecat",
      action: "BILLING_TRANSFER_OUTCOME",
      pageSize: 200,
    })
  ).find(
    (entry) => entry.details.eventId === transientTransfer.id && entry.details.outcome === "failed",
  );
  assert.ok(transientFailureAudit);
  assert.equal(transientFailureAudit.details.retryAttempt, 1);
  assert.ok(typeof transientFailureAudit.details.retryAfter === "string");
  await db
    .update(tradifyAdminAuditEvents)
    .set({
      details: {
        ...transientFailureAudit.details,
        retryAfter: new Date(Date.now() - REVENUECAT_RETRY_BASE_DELAY_MS).toISOString(),
      },
    })
    .where(eq(tradifyAdminAuditEvents.id, transientFailureAudit.id));
  const recoveredTransfer = await webhook(transientTransfer);
  assert.equal(recoveredTransfer.status, 200);
  assert.equal(recoveredTransfer.body.result, "processed");
  assert.equal(transientTransferLookups, 2);
  const transferredTransientSource = await membership(transientSource.token);
  assert.equal(transferredTransientSource.body.membership, "Free");
  assert.equal(transferredTransientSource.body.billingStatus, "EXPIRED");
  const transferredTransientDestination = await membership(transientDestination.token);
  assert.equal(transferredTransientDestination.body.membership, "VIP");
  assert.equal(transferredTransientDestination.body.billingStatus, "ACTIVE");
  const duplicateRetriedTransfer = await webhook(transientTransfer);
  assert.equal(duplicateRetriedTransfer.body.result, "duplicate");
  assert.equal(transientTransferLookups, 2);

  const multiSourceVip = await registerBillingUser("multi-source-vip");
  const multiSourcePro = await registerBillingUser("multi-source-pro");
  const multiDestinationPro = await registerBillingUser("multi-destination-pro");
  const multiDestinationVip = await registerBillingUser("multi-destination-vip");
  const multiSourceVipPurchase = await webhook({
    id: `multi-source-vip-purchase-${testRunId}`,
    type: "INITIAL_PURCHASE",
    app_user_id: multiSourceVip.id,
    entitlement_ids: ["vip"],
    event_timestamp_ms: 53_000,
  });
  assert.equal(multiSourceVipPurchase.body.result, "processed");
  const multiSourceProPurchase = await webhook({
    id: `multi-source-pro-purchase-${testRunId}`,
    type: "INITIAL_PURCHASE",
    app_user_id: multiSourcePro.id,
    entitlement_ids: ["pro"],
    event_timestamp_ms: 54_000,
  });
  assert.equal(multiSourceProPurchase.body.result, "processed");
  const multiDestinationProPurchase = await webhook({
    id: `multi-destination-pro-purchase-${testRunId}`,
    type: "INITIAL_PURCHASE",
    app_user_id: multiDestinationPro.id,
    entitlement_ids: ["pro"],
    event_timestamp_ms: 55_000,
  });
  assert.equal(multiDestinationProPurchase.body.result, "processed");
  const multiDestinationVipPurchase = await webhook({
    id: `multi-destination-vip-purchase-${testRunId}`,
    type: "INITIAL_PURCHASE",
    app_user_id: multiDestinationVip.id,
    entitlement_ids: ["vip"],
    event_timestamp_ms: 56_000,
  });
  assert.equal(multiDestinationVipPurchase.body.result, "processed");
  let multiTransferLookups = 0;
  const multiTransferLookupIds: string[] = [];
  revenueCatBillingProvider.get = async (appUserId) => {
    multiTransferLookups += 1;
    multiTransferLookupIds.push(appUserId);
    assert.equal(
      appUserId,
      [multiDestinationPro.id, multiDestinationVip.id][(multiTransferLookups - 1) % 2],
    );
    if (multiTransferLookups === 2) {
      return { membership: "Free", status: "UNAVAILABLE", expiresAt: null, willRenew: false };
    }
    return appUserId === multiDestinationPro.id
      ? mapRevenueCatBillingState(fixtures.activeVip)
      : mapRevenueCatBillingState(fixtures.activePro);
  };
  const multiDestinationTransfer = {
    id: `multi-destination-provider-transfer-${testRunId}`,
    type: "TRANSFER",
    app_user_id: multiDestinationPro.id,
    transferred_from: [multiSourceVip.id, multiSourcePro.id],
    transferred_to: [multiDestinationPro.id, multiDestinationVip.id],
    event_timestamp_ms: 57_000,
  };
  const unavailableMultiTransfer = await webhook(multiDestinationTransfer);
  assert.equal(unavailableMultiTransfer.status, 503);
  assert.equal(unavailableMultiTransfer.body.error, "BILLING_WEBHOOK_RETRY");
  assert.equal(typeof unavailableMultiTransfer.body.message, "string");
  assert.equal(typeof unavailableMultiTransfer.body.requestId, "number");
  assert.deepEqual(multiTransferLookupIds, [multiDestinationPro.id, multiDestinationVip.id]);
  assert.equal((await membership(multiSourceVip.token)).body.membership, "VIP");
  assert.equal((await membership(multiSourcePro.token)).body.membership, "Pro");
  assert.equal((await membership(multiDestinationPro.token)).body.membership, "Pro");
  assert.equal((await membership(multiDestinationVip.token)).body.membership, "VIP");

  const retriedMultiTransfer = await webhook(multiDestinationTransfer);
  assert.equal(retriedMultiTransfer.status, 200);
  assert.equal(retriedMultiTransfer.body.result, "deferred");
  const multiFailureAudit = (
    await getAdminAuditLog({
      actorId: "system:revenuecat",
      action: "BILLING_TRANSFER_OUTCOME",
      pageSize: 200,
    })
  ).find(
    (entry) =>
      entry.details.eventId === multiDestinationTransfer.id && entry.details.outcome === "failed",
  );
  assert.ok(multiFailureAudit);
  await db
    .update(tradifyAdminAuditEvents)
    .set({
      details: {
        ...multiFailureAudit.details,
        retryAfter: new Date(Date.now() - REVENUECAT_RETRY_BASE_DELAY_MS).toISOString(),
      },
    })
    .where(eq(tradifyAdminAuditEvents.id, multiFailureAudit.id));
  const recoveredMultiTransfer = await webhook(multiDestinationTransfer);
  assert.equal(recoveredMultiTransfer.body.result, "processed");
  assert.equal(multiTransferLookups, 4);
  assert.deepEqual(multiTransferLookupIds, [
    multiDestinationPro.id,
    multiDestinationVip.id,
    multiDestinationPro.id,
    multiDestinationVip.id,
  ]);
  assert.equal((await membership(multiSourceVip.token)).body.membership, "Free");
  assert.equal((await membership(multiSourcePro.token)).body.membership, "Free");
  assert.equal((await membership(multiDestinationPro.token)).body.membership, "VIP");
  assert.equal((await membership(multiDestinationVip.token)).body.membership, "Pro");
  const duplicateMultiTransfer = await webhook(multiDestinationTransfer);
  assert.equal(duplicateMultiTransfer.body.result, "duplicate");
  assert.equal(multiTransferLookups, 4);
  assert.equal((await membership(multiSourceVip.token)).body.billingStatus, "EXPIRED");
  assert.equal((await membership(multiSourcePro.token)).body.billingStatus, "EXPIRED");

  const partialSource = await registerBillingUser("partial-source");
  const partialKnownDestination = await registerBillingUser("partial-known-destination");
  const missingPartialDestinationId = `partial-destination-created-later-${testRunId}`;
  let partialRetryLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    assert.equal(appUserId, partialKnownDestination.id);
    partialRetryLookups += 1;
    return mapRevenueCatBillingState(fixtures.activeVip);
  };
  const partialTransfer = {
    id: `partial-transfer-${testRunId}`,
    type: "TRANSFER",
    app_user_id: partialKnownDestination.id,
    transferred_from: [partialSource.id],
    transferred_to: [partialKnownDestination.id, missingPartialDestinationId],
    event_timestamp_ms: 50_000,
  };
  const partialTransferResult = await webhook(partialTransfer);
  assert.equal(partialTransferResult.body.result, "processed");
  assert.equal(partialRetryLookups, 1);
  assert.equal((await membership(partialSource.token)).body.membership, "Free");
  assert.equal((await membership(partialKnownDestination.token)).body.membership, "VIP");

  const partialRetryResult = await webhook(partialTransfer);
  assert.equal(partialRetryResult.body.result, "duplicate");
  assert.equal(partialRetryLookups, 1);
  const afterPartialRetry = await membership(partialKnownDestination.token);
  assert.equal(afterPartialRetry.body.membership, "VIP");
  assert.equal(afterPartialRetry.body.billingStatus, "ACTIVE");

  let deferredRegistrationLookups = 0;
  revenueCatBillingProvider.get = async () => {
    deferredRegistrationLookups += 1;
    return { membership: "Free", status: "UNAVAILABLE", expiresAt: null, willRenew: false };
  };
  const deferredDestinationEmail = `billing-transfer-deferred-destination-${process.pid}@example.test`;
  const deferredDestinationAuth = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: deferredDestinationEmail,
      password: "billing-pass",
      userId: missingPartialDestinationId,
    }),
  });
  assert.equal(deferredDestinationAuth.status, 201);
  assert.equal(deferredDestinationAuth.body.recovery, "provider-deferred");
  assert.equal(deferredRegistrationLookups, 1);
  const deferredDestinationBeforeRecovery = await membership(
    String(deferredDestinationAuth.body.token),
  );
  assert.equal(deferredDestinationBeforeRecovery.body.membership, "Free");
  assert.deepEqual(deferredDestinationBeforeRecovery.body.entitlements, []);

  const permitDeferredTransferRetry = async () => {
    const failureAudit = (
      await getAdminAuditLog({
        actorId: "system:revenuecat",
        action: "BILLING_TRANSFER_OUTCOME",
        pageSize: 200,
      })
    ).find(
      (entry) => entry.details.eventId === partialTransfer.id && entry.details.outcome === "failed",
    );
    assert.ok(failureAudit);
    await db
      .update(tradifyAdminAuditEvents)
      .set({
        details: {
          ...failureAudit.details,
          retryAfter: new Date(Date.now() - REVENUECAT_RETRY_BASE_DELAY_MS).toISOString(),
        },
      })
      .where(eq(tradifyAdminAuditEvents.id, failureAudit.id));
  };

  await permitDeferredTransferRetry();
  const deferredReconciliation = await request("/billing/revenuecat/reconcile", {
    method: "POST",
    headers: { authorization: `Bearer ${String(deferredDestinationAuth.body.token)}` },
  });
  assert.equal(deferredReconciliation.status, 200);
  assert.equal(deferredReconciliation.body.result, "deferred");
  assert.equal(deferredReconciliation.body.recovery, "provider-deferred");
  assert.equal(deferredRegistrationLookups, 2);

  await permitDeferredTransferRetry();
  const reconciliationProvider = revenueCatBillingProvider.get;
  try {
    revenueCatBillingProvider.get = async () => {
      throw new Error("temporary reconciliation outage");
    };
    const unavailableReconciliation = await request("/billing/revenuecat/reconcile", {
      method: "POST",
      headers: { authorization: `Bearer ${String(deferredDestinationAuth.body.token)}` },
    });
    assert.equal(unavailableReconciliation.status, 503);
    assert.equal(unavailableReconciliation.body.error, "BILLING_WEBHOOK_RETRY");
    assert.equal(typeof unavailableReconciliation.body.message, "string");
    assert.equal(typeof unavailableReconciliation.body.requestId, "number");
  } finally {
    revenueCatBillingProvider.get = reconciliationProvider;
  }

  revenueCatBillingProvider.get = async () => mapRevenueCatBillingState(fixtures.activeVip);
  await permitDeferredTransferRetry();
  const recoveredRegistrationTransfer = await request("/billing/revenuecat/reconcile", {
    method: "POST",
    headers: { authorization: `Bearer ${String(deferredDestinationAuth.body.token)}` },
  });
  assert.equal(recoveredRegistrationTransfer.status, 200);
  assert.equal(recoveredRegistrationTransfer.body.result, "processed");
  assert.equal(recoveredRegistrationTransfer.body.recovery, "recovered");
  const recoveredRegistrationMembership = await membership(
    String(deferredDestinationAuth.body.token),
  );
  assert.equal(recoveredRegistrationMembership.body.membership, "VIP");
  assert.equal(recoveredRegistrationMembership.body.billingStatus, "ACTIVE");

  const alreadyRecoveredRegistrationTransfer = await request("/billing/revenuecat/reconcile", {
    method: "POST",
    headers: { authorization: `Bearer ${String(deferredDestinationAuth.body.token)}` },
  });
  assert.equal(alreadyRecoveredRegistrationTransfer.status, 200);
  assert.equal(alreadyRecoveredRegistrationTransfer.body.result, "ignored");
  assert.equal(alreadyRecoveredRegistrationTransfer.body.recovery, "already-recovered");

  const restartCrossProcessSource = await registerBillingUser("restart-cross-process-source");
  const restartCrossProcessDestination = await registerBillingUser(
    "restart-cross-process-destination",
  );
  const missingDestinationId = `account-created-later-${testRunId}`;
  const missingDestinationTransferTimestamp = lifecycleEventBase + 7_000;
  const missingDestinationTransfer = await webhook({
    id: restartTransferEventId,
    type: "TRANSFER",
    app_user_id: missingDestinationId,
    transferred_from: [destinationId],
    transferred_to: [missingDestinationId],
    event_timestamp_ms: missingDestinationTransferTimestamp,
  });
  assert.equal(missingDestinationTransfer.status, 200);
  assert.equal(missingDestinationTransfer.body.result, "processed");
  const adminFixture = await createTestAdmin(baseUrl);
  const adminAuth = { body: { token: adminFixture.token } };
  const validTransferAuditEventId = `valid-transfer-audit-${testRunId}`;
  const validTransferAudit = await recordAdminAudit({
    actorId: "system:revenuecat",
    actorEmail: "revenuecat-webhook",
    action: "BILLING_TRANSFER_OUTCOME",
    details: {
      eventId: validTransferAuditEventId,
      outcome: "processed",
      transferTimestamp: "2026-09-08T00:00:00.000Z",
    },
    createdAt: new Date(Date.now() + 1).toISOString(),
  });
  await db.insert(tradifyAdminAuditEvents).values({
    id: malformedAuditRecordId,
    actorId: "system:revenuecat",
    actorEmail: "revenuecat-webhook",
    action: "BILLING_TRANSFER_OUTCOME",
    details: "corrupted-transfer-details",
    createdAt: new Date(Date.now() + 2).toISOString(),
  });
  const billingTransfers = await request("/admin/billing/transfers", {
    headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
  });
  assert.equal(billingTransfers.status, 200);
  const billingOutcomes = billingTransfers.body.outcomes as Array<Record<string, unknown>>;
  const validTransferAuditOutcome = billingOutcomes.find(
    (entry) => entry.id === validTransferAudit.id,
  );
  assert.equal(
    (validTransferAuditOutcome?.details as Record<string, unknown>)?.eventId,
    validTransferAuditEventId,
  );
  assert.equal(
    billingOutcomes.some((entry) => entry.id === malformedAuditRecordId),
    false,
  );
  const accountFilterSourceId = `account-filter-source-${testRunId}`;
  const accountFilterDestinationId = `account-filter-destination-${testRunId}`;
  const accountFilterAudit = await recordAdminAudit({
    actorId: "system:revenuecat",
    actorEmail: "revenuecat-webhook",
    action: "BILLING_TRANSFER_OUTCOME",
    details: {
      eventId: `account-filter-transfer-${testRunId}`,
      outcome: "processed",
      previousAppUserIds: [accountFilterSourceId],
      destinationAppUserIds: [accountFilterDestinationId],
      transferTimestamp: "2026-09-08T00:00:00.000Z",
    },
    createdAt: new Date(Date.UTC(2020, 0, 1)).toISOString(),
  });
  for (let index = 0; index < 55; index += 1) {
    await recordAdminAudit({
      actorId: "system:revenuecat",
      actorEmail: "revenuecat-webhook",
      action: "BILLING_TRANSFER_OUTCOME",
      details: {
        eventId: `account-filter-history-${testRunId}-${index}`,
        outcome: "processed",
        previousAppUserIds: [accountFilterSourceId],
        destinationAppUserIds: [`account-filter-history-destination-${testRunId}-${index}`],
        transferTimestamp: "2026-09-08T00:00:00.000Z",
      },
      createdAt: new Date(Date.UTC(2020, 0, 2, 0, index)).toISOString(),
    });
  }
  const sourceAccountFilteredTransfers = await request(
    `/admin/billing/transfers?accountId=${encodeURIComponent(accountFilterSourceId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(sourceAccountFilteredTransfers.status, 200);
  assert.equal(
    (sourceAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).some(
      (entry) => entry.id === accountFilterAudit.id,
    ),
    true,
  );
  assert.ok(
    (sourceAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).length >= 56,
  );
  assert.equal(
    (sourceAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).every(
      (entry) => {
        const details = entry.details as Record<string, unknown>;
        return [details.previousAppUserIds, details.destinationAppUserIds].some(
          (ids) => Array.isArray(ids) && ids.includes(accountFilterSourceId),
        );
      },
    ),
    true,
  );
  const sourceAccountOutcome = (
    sourceAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>
  ).find((entry) => entry.id === accountFilterAudit.id);
  assert.deepEqual((sourceAccountOutcome?.details as Record<string, unknown>)?.matchedAccounts, [
    { accountId: accountFilterSourceId, side: "source" },
  ]);
  const destinationAccountFilteredTransfers = await request(
    `/admin/billing/transfers?accountId=${encodeURIComponent(accountFilterDestinationId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(destinationAccountFilteredTransfers.status, 200);
  assert.equal(
    (destinationAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).some(
      (entry) => entry.id === accountFilterAudit.id,
    ),
    true,
  );
  assert.equal(
    (destinationAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).every(
      (entry) => {
        const details = entry.details as Record<string, unknown>;
        return [details.previousAppUserIds, details.destinationAppUserIds].some(
          (ids) => Array.isArray(ids) && ids.includes(accountFilterDestinationId),
        );
      },
    ),
    true,
  );
  const destinationAccountOutcome = (
    destinationAccountFilteredTransfers.body.outcomes as Array<Record<string, unknown>>
  ).find((entry) => entry.id === accountFilterAudit.id);
  assert.deepEqual(
    (destinationAccountOutcome?.details as Record<string, unknown>)?.matchedAccounts,
    [{ accountId: accountFilterDestinationId, side: "destination" }],
  );
  const accountFilterSecondSourceId = `account-filter-second-source-${testRunId}`;
  const accountFilterSecondDestinationId = `account-filter-second-destination-${testRunId}`;
  const multiAccountFilterEventId = `account-filter-multi-transfer-${testRunId}`;
  await recordAdminAudit({
    actorId: "system:revenuecat",
    actorEmail: "revenuecat-webhook",
    action: "BILLING_TRANSFER_OUTCOME",
    details: {
      eventId: multiAccountFilterEventId,
      outcome: "processed",
      previousAppUserIds: [accountFilterSourceId, accountFilterSecondSourceId],
      destinationAppUserIds: [accountFilterDestinationId, accountFilterSecondDestinationId],
      transferTimestamp: "2026-09-08T00:00:00.000Z",
    },
    createdAt: new Date(Date.UTC(2020, 0, 3)).toISOString(),
  });
  const multiAccountFilteredTransfers = await request(
    `/admin/billing/transfers?accountIds=${encodeURIComponent(accountFilterSourceId)}&accountIds=${encodeURIComponent(accountFilterSecondSourceId)}&accountIds=${encodeURIComponent(accountFilterDestinationId)}&accountIds=${encodeURIComponent(accountFilterSecondDestinationId)}&accountIds=${encodeURIComponent(accountFilterSourceId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(multiAccountFilteredTransfers.status, 200);
  const multiAccountOutcomes = multiAccountFilteredTransfers.body.outcomes as Array<
    Record<string, unknown>
  >;
  assert.equal(
    multiAccountOutcomes.filter((entry) => entry.id === accountFilterAudit.id).length,
    1,
  );
  const multiAccountOutcome = multiAccountOutcomes.find(
    (entry) =>
      entry.details &&
      (entry.details as Record<string, unknown>).eventId ===
        `account-filter-multi-transfer-${testRunId}`,
  );
  assert.deepEqual((multiAccountOutcome?.details as Record<string, unknown>)?.matchedAccounts, [
    { accountId: accountFilterSourceId, side: "source" },
    { accountId: accountFilterSecondSourceId, side: "source" },
    { accountId: accountFilterDestinationId, side: "destination" },
    { accountId: accountFilterSecondDestinationId, side: "destination" },
  ]);
  assert.equal(
    multiAccountOutcomes.every((entry) => {
      const details = entry.details as Record<string, unknown>;
      return [details.previousAppUserIds, details.destinationAppUserIds].some(
        (ids) =>
          Array.isArray(ids) &&
          ids.some((id) => id === accountFilterSourceId || id === accountFilterDestinationId),
      );
    }),
    true,
  );
  const commaSeparatedMultiAccountIds = [
    accountFilterSourceId,
    accountFilterSecondSourceId,
    accountFilterDestinationId,
    accountFilterSecondDestinationId,
    accountFilterSourceId,
  ];
  const commaSeparatedMultiAccountRequest = await request(
    `/admin/billing/transfers?accountIds=${encodeURIComponent(commaSeparatedMultiAccountIds.join(","))}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(commaSeparatedMultiAccountRequest.status, 200);
  const commaSeparatedMultiAccountOutcomes = commaSeparatedMultiAccountRequest.body
    .outcomes as Array<Record<string, unknown>>;
  const commaSeparatedMultiAccountMatches = commaSeparatedMultiAccountOutcomes.filter(
    (entry) => (entry.details as Record<string, unknown>)?.eventId === multiAccountFilterEventId,
  );
  assert.equal(commaSeparatedMultiAccountMatches.length, 1);
  assert.deepEqual(
    (commaSeparatedMultiAccountMatches[0]?.details as Record<string, unknown>)?.matchedAccounts,
    [
      { accountId: accountFilterSourceId, side: "source" },
      { accountId: accountFilterSecondSourceId, side: "source" },
      { accountId: accountFilterDestinationId, side: "destination" },
      { accountId: accountFilterSecondDestinationId, side: "destination" },
    ],
  );
  const pendingSourceFilteredTransfers = await request(
    `/admin/billing/transfers?accountId=${encodeURIComponent(destinationId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(pendingSourceFilteredTransfers.status, 200);
  assert.equal(
    (pendingSourceFilteredTransfers.body.pending as Array<Record<string, unknown>>).some(
      (entry) => entry.eventId === restartTransferEventId,
    ),
    true,
  );
  const pendingSourceTransfer = (
    pendingSourceFilteredTransfers.body.pending as Array<Record<string, unknown>>
  ).find((entry) => entry.eventId === restartTransferEventId);
  assert.deepEqual(pendingSourceTransfer?.matchedAccounts, [
    { accountId: destinationId, side: "source" },
  ]);
  const pendingDestinationFilteredTransfers = await request(
    `/admin/billing/transfers?accountId=${encodeURIComponent(missingDestinationId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(pendingDestinationFilteredTransfers.status, 200);
  assert.equal(
    (pendingDestinationFilteredTransfers.body.pending as Array<Record<string, unknown>>).some(
      (entry) => entry.eventId === restartTransferEventId,
    ),
    true,
  );
  const pendingDestinationTransfer = (
    pendingDestinationFilteredTransfers.body.pending as Array<Record<string, unknown>>
  ).find((entry) => entry.eventId === restartTransferEventId);
  assert.deepEqual(pendingDestinationTransfer?.matchedAccounts, [
    { accountId: missingDestinationId, side: "destination" },
  ]);
  const pendingHandoff = await request(
    `/admin/billing/transfers/handoff?eventId=${encodeURIComponent(restartTransferEventId)}&accountIds=${encodeURIComponent(missingDestinationId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(pendingHandoff.status, 200);
  assert.deepEqual(pendingHandoff.body.matchedAccounts, [
    { accountId: missingDestinationId, side: "destination" },
  ]);
  assert.match(String(pendingHandoff.body.summary), /Source account side:/);
  assert.match(String(pendingHandoff.body.summary), /Destination account side:/);
  assert.match(
    String(pendingHandoff.body.summary),
    new RegExp(`${missingDestinationId} \\(destination side\\)`),
  );
  assert.doesNotMatch(String(pendingHandoff.body.summary), /api[_ -]?key|secret|password|token/i);
  const mismatchedHandoff = await request(
    `/admin/billing/transfers/handoff?eventId=${encodeURIComponent(restartTransferEventId)}&accountIds=not-a-participant`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(mismatchedHandoff.status, 404);
  const pendingMultiAccountFilteredTransfers = await request(
    `/admin/billing/transfers?accountIds=${encodeURIComponent(destinationId)}&accountIds=${encodeURIComponent(missingDestinationId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(pendingMultiAccountFilteredTransfers.status, 200);
  assert.equal(
    (pendingMultiAccountFilteredTransfers.body.pending as Array<Record<string, unknown>>).filter(
      (entry) => entry.eventId === restartTransferEventId,
    ).length,
    1,
  );
  const invalidAccountId = await request("/admin/billing/transfers?accountId=%20", {
    headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
  });
  assert.equal(invalidAccountId.status, 400);
  assert.equal((invalidAccountId.body as { error?: string }).error, "INVALID_ACCOUNT_ID");
  const invalidAccountIds = await request(
    "/admin/billing/transfers?accountIds=destination-one,,destination-two",
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(invalidAccountIds.status, 400);
  assert.equal((invalidAccountIds.body as { error?: string }).error, "INVALID_ACCOUNT_ID");
  const providerFilteredTransfers = await request(
    "/admin/billing/transfers?failureCategory=PROVIDER_UNAVAILABLE",
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(providerFilteredTransfers.status, 200);
  assert.deepEqual(providerFilteredTransfers.body.pending, billingTransfers.body.pending);
  assert.ok((providerFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).length > 0);
  assert.ok(
    (providerFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).every(
      (entry) =>
        (entry.details as Record<string, unknown>)?.failureCategory === "PROVIDER_UNAVAILABLE",
    ),
  );
  const eventIdFilteredTransfers = await request(
    `/admin/billing/transfers?eventId=${encodeURIComponent(validTransferAuditEventId)}`,
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(eventIdFilteredTransfers.status, 200);
  assert.deepEqual(eventIdFilteredTransfers.body.pending, billingTransfers.body.pending);
  assert.ok((eventIdFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).length > 0);
  assert.ok(
    (eventIdFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).every(
      (entry) => (entry.details as Record<string, unknown>)?.eventId === validTransferAuditEventId,
    ),
  );
  const missingEventIdTransfers = await request(
    "/admin/billing/transfers?eventId=missing-transfer-event",
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(missingEventIdTransfers.status, 200);
  assert.deepEqual(missingEventIdTransfers.body.pending, billingTransfers.body.pending);
  assert.deepEqual(missingEventIdTransfers.body.outcomes, []);
  const invalidEventId = await request("/admin/billing/transfers?eventId=%20", {
    headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
  });
  assert.equal(invalidEventId.status, 400);
  assert.equal((invalidEventId.body as { error?: string }).error, "INVALID_EVENT_ID");
  const historicalReconciliationEventIds = new Set(
    Array.from({ length: 55 }, (_, index) => `historical-reconciliation-${testRunId}-${index}`),
  );
  for (const [index, eventId] of [...historicalReconciliationEventIds].entries()) {
    await recordAdminAudit({
      actorId: "system:revenuecat",
      actorEmail: "revenuecat-webhook",
      action: "BILLING_TRANSFER_OUTCOME",
      details: {
        eventId,
        outcome: "failed",
        transferTimestamp: "2026-01-01T00:00:00.000Z",
        failureCategory: "RECONCILIATION_FAILED",
      },
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString(),
    });
  }
  const reconciliationFilteredTransfers = await request(
    "/admin/billing/transfers?failureCategory=RECONCILIATION_FAILED",
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(reconciliationFilteredTransfers.status, 200);
  assert.deepEqual(reconciliationFilteredTransfers.body.pending, billingTransfers.body.pending);
  const historicalReconciliationOutcomes = (
    reconciliationFilteredTransfers.body.outcomes as Array<Record<string, unknown>>
  ).filter((entry) =>
    historicalReconciliationEventIds.has(
      String((entry.details as Record<string, unknown>)?.eventId),
    ),
  );
  assert.equal(historicalReconciliationOutcomes.length, historicalReconciliationEventIds.size);
  assert.ok(
    (reconciliationFilteredTransfers.body.outcomes as Array<Record<string, unknown>>).every(
      (entry) =>
        (entry.details as Record<string, unknown>)?.failureCategory === "RECONCILIATION_FAILED",
    ),
  );
  const invalidFailureCategory = await request(
    "/admin/billing/transfers?failureCategory=provider-error",
    {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    },
  );
  assert.equal(invalidFailureCategory.status, 400);
  assert.equal(
    (invalidFailureCategory.body as { error?: string }).error,
    "INVALID_FAILURE_CATEGORY",
  );
  const pendingTransfer = (billingTransfers.body.pending as Array<Record<string, unknown>>).find(
    (entry) => entry.eventId === restartTransferEventId,
  );
  assert.deepEqual(
    pendingTransfer && {
      eventId: pendingTransfer.eventId,
      previousAppUserIds: pendingTransfer.previousAppUserIds,
      destinationAppUserIds: pendingTransfer.destinationAppUserIds,
      transferTimestamp: pendingTransfer.transferTimestamp,
    },
    {
      eventId: restartTransferEventId,
      previousAppUserIds: [destinationId],
      destinationAppUserIds: [missingDestinationId],
      transferTimestamp: new Date(missingDestinationTransferTimestamp).toISOString(),
    },
  );
  const transferAudit = (billingTransfers.body.outcomes as Array<Record<string, unknown>>).find(
    (entry) => (entry.details as Record<string, unknown>)?.eventId === restartTransferEventId,
  );
  assert.equal((transferAudit?.details as Record<string, unknown>)?.outcome, "processed");
  assert.deepEqual((transferAudit?.details as Record<string, unknown>)?.previousAppUserIds, [
    destinationId,
  ]);
  assert.deepEqual((transferAudit?.details as Record<string, unknown>)?.destinationAppUserIds, [
    missingDestinationId,
  ]);
  const transferLock = (transferAudit?.details as Record<string, unknown>)?.lock as Record<
    string,
    unknown
  >;
  assert.ok(transferLock);
  assert.ok(["ACQUIRED", "WAITED"].includes(String(transferLock.outcome)));
  assert.equal(typeof transferLock.waitMs, "number");
  assert.equal(transferLock.participantCount, 2);
  const failedTransferAudit = (
    billingTransfers.body.outcomes as Array<Record<string, unknown>>
  ).find((entry) => {
    const details = entry.details as Record<string, unknown>;
    return details?.eventId === transientTransfer.id && details?.outcome === "failed";
  });
  assert.equal(
    (failedTransferAudit?.details as Record<string, unknown>)?.failureCategory,
    "PROVIDER_UNAVAILABLE",
  );
  assert.equal(
    (failedTransferAudit?.details as Record<string, unknown>)?.failurePhase,
    "RECONCILIATION",
  );
  assert.equal(
    (failedTransferAudit?.details as Record<string, unknown>)?.recoveryState,
    "ESCALATE",
  );
  assert.equal((failedTransferAudit?.details as Record<string, unknown>)?.safeToRetry, false);
  assert.equal((failedTransferAudit?.details as Record<string, unknown>)?.escalationRequired, true);
  assert.equal(
    (failedTransferAudit?.details as Record<string, unknown>)?.retentionState,
    "EXPIRED",
  );
  assert.ok((failedTransferAudit?.details as Record<string, unknown>)?.lock);
  assert.equal(JSON.stringify(billingTransfers.body).includes("billing-webhook-secret"), false);
  assert.equal(JSON.stringify(billingTransfers.body).includes("provider disconnected"), false);
  const afterMissingDestination = await request("/membership/status", {
    headers: { authorization: `Bearer ${String(destinationAuth.body.token)}` },
  });
  assert.equal(afterMissingDestination.body.membership, "Free");
  assert.equal(afterMissingDestination.body.billingStatus, "EXPIRED");
  assert.equal(transferLookups, 1);

  const duplicateMissingDestination = await webhook({
    id: restartTransferEventId,
    type: "TRANSFER",
    app_user_id: missingDestinationId,
    transferred_from: [destinationId],
    transferred_to: [missingDestinationId],
    event_timestamp_ms: missingDestinationTransferTimestamp,
  });
  assert.equal(duplicateMissingDestination.body.result, "duplicate");
  const sourceRecovery = await request("/billing/revenuecat/reconcile", {
    method: "POST",
    headers: {
      authorization: `Bearer ${String(destinationAuth.body.token)}`,
    },
  });
  assert.equal(sourceRecovery.status, 200);
  assert.equal(sourceRecovery.body.result, "ignored");
  assert.equal(transferLookups, 1);

  const expiredMissingDestinationId = `expired-transfer-account-created-later-${testRunId}`;
  const expiredTransfer = await webhook({
    id: expiredTransferEventId,
    type: "TRANSFER",
    app_user_id: expiredMissingDestinationId,
    transferred_from: [String(auth.body.user && (auth.body.user as Record<string, unknown>).id)],
    transferred_to: [expiredMissingDestinationId],
    event_timestamp_ms: lifecycleEventBase + 8_000,
  });
  assert.equal(expiredTransfer.status, 200);
  assert.equal(expiredTransfer.body.result, "processed");
  await db
    .update(tradifyRevenueCatTransfers)
    .set({ expiresAt: "2000-01-01T00:00:00.000Z" })
    .where(eq(tradifyRevenueCatTransfers.eventId, expiredTransferEventId));
  await db.insert(tradifyRevenueCatTransfers).values({
    eventId: malformedTransferEventId,
    eventTimestampMs: "9000",
    previousAppUserIds: [String(auth.body.user && (auth.body.user as Record<string, unknown>).id)],
    destinationAppUserIds: ["valid-destination", null] as unknown as string[],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await db.insert(tradifyRevenueCatTransfers).values({
    eventId: malformedExpiryTransferEventId,
    eventTimestampMs: "13000",
    previousAppUserIds: [String(auth.body.user && (auth.body.user as Record<string, unknown>).id)],
    destinationAppUserIds: [`malformed-expiry-destination-${testRunId}`],
    createdAt: new Date().toISOString(),
    expiresAt: "not-a-date",
  });
  await db.insert(tradifyRevenueCatTransfers).values([
    {
      eventId: emptySavedTransferEventId,
      eventTimestampMs: "10000",
      previousAppUserIds: [],
      destinationAppUserIds: [destinationId],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    {
      eventId: duplicateSavedTransferEventId,
      eventTimestampMs: "11000",
      previousAppUserIds: [sourceId, sourceId],
      destinationAppUserIds: [destinationId],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    {
      eventId: overlappingSavedTransferEventId,
      eventTimestampMs: "12000",
      previousAppUserIds: [sourceId],
      destinationAppUserIds: [sourceId, destinationId],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  ]);
  const malformedTimestampDestinationId = `malformed-timestamp-transfer-account-created-later-${testRunId}`;
  await db.insert(tradifyRevenueCatTransfers).values({
    eventId: malformedTimestampTransferEventId,
    eventTimestampMs: "not-a-number",
    previousAppUserIds: [String(auth.body.user && (auth.body.user as Record<string, unknown>).id)],
    destinationAppUserIds: [malformedTimestampDestinationId],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  await closeServer();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs",
            import.meta.url,
          ),
        ),
        fileURLToPath(new URL("./revenuecat-billing.restart-probe.ts", import.meta.url)),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BILLING_RESTART_TRANSFER_EVENT_ID: restartTransferEventId,
          BILLING_RESTART_TRANSFER_TIMESTAMP_MS: String(missingDestinationTransferTimestamp),
          BILLING_EXPIRED_TRANSFER_EVENT_ID: expiredTransferEventId,
          BILLING_MALFORMED_TRANSFER_EVENT_ID: malformedTransferEventId,
          BILLING_MALFORMED_EXPIRY_TRANSFER_EVENT_ID: malformedExpiryTransferEventId,
          BILLING_EMPTY_SAVED_TRANSFER_EVENT_ID: emptySavedTransferEventId,
          BILLING_DUPLICATE_SAVED_TRANSFER_EVENT_ID: duplicateSavedTransferEventId,
          BILLING_OVERLAPPING_SAVED_TRANSFER_EVENT_ID: overlappingSavedTransferEventId,
          BILLING_MALFORMED_TIMESTAMP_TRANSFER_EVENT_ID: malformedTimestampTransferEventId,
          BILLING_MALFORMED_TIMESTAMP_DESTINATION_ID: malformedTimestampDestinationId,
          BILLING_MALFORMED_TIMESTAMP_SOURCE_ID: sourceId,
          BILLING_MALFORMED_TIMESTAMP_SOURCE_EMAIL: email,
          BILLING_EXPECTED_DESTINATION_ID: missingDestinationId,
          BILLING_EXPECTED_SOURCE_EMAIL: destinationEmail,
          BILLING_RESTART_LIFECYCLE_EVENT_ID: restartLifecycleEventId,
          BILLING_RESTART_CROSS_PROCESS_TRANSFER_EVENT_ID: restartCrossProcessTransferEventId,
          BILLING_RESTART_CROSS_PROCESS_SOURCE_ID: restartCrossProcessSource.id,
          BILLING_RESTART_CROSS_PROCESS_DESTINATION_ID: restartCrossProcessDestination.id,
          BILLING_RESTART_CROSS_PROCESS_PROVIDER_DELAY_MS: String(
            restartCrossProcessProviderDelayMs,
          ),
          BILLING_RESTART_REQUESTED_USER_ID: restartRequestedUserId,
          BILLING_RESTART_REQUESTED_EMAIL: restartRequestedEmail,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve() : reject(new Error(output))));
  });
} finally {
  revenueCatBillingProvider.get = originalProvider;
  if (previousWebhookSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SECRET;
  else process.env.REVENUECAT_WEBHOOK_SECRET = previousWebhookSecret;
  await closeServer();
  await pool.end();
}

console.log("RevenueCat billing checks passed.");
