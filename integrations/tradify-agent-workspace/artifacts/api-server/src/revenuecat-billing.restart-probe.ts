import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import app from "./app";
import { createTestAdmin } from "./test-admin";
import { revenueCatBillingProvider } from "./routes/tradify";

type ProbeWorkerRole = "lifecycle" | "transfer-old" | "transfer-new";

async function runProbeWorker(): Promise<void> {
  const destinationId = process.env.BILLING_RESTART_CROSS_PROCESS_DESTINATION_ID;
  const role = process.env.BILLING_PROBE_WORKER_ROLE;
  const providerDelayMs = Number(
    process.env.BILLING_RESTART_CROSS_PROCESS_PROVIDER_DELAY_MS ?? "0",
  );
  assert.ok(destinationId);
  assert.ok(role === "lifecycle" || role === "transfer-old" || role === "transfer-new");
  assert.ok(Number.isInteger(providerDelayMs) && providerDelayMs >= 0);
  revenueCatBillingProvider.get = async (appUserId) => {
    assert.equal(appUserId, destinationId);
    if (role !== "lifecycle" && providerDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, providerDelayMs));
    }
    return {
      membership: "VIP",
      status: "ACTIVE",
      expiresAt: "2026-10-01T00:00:00.000Z",
      willRenew: true,
    };
  };

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  console.log(`BILLING_RESTART_PROBE_READY:${port}`);

  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  await new Promise<void>(() => undefined);
}

async function runRegistrationCollisionWorker(): Promise<void> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  console.log(`BILLING_REGISTRATION_COLLISION_READY:${port}`);

  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  await new Promise<void>(() => undefined);
}

async function startProbeWorker(role: ProbeWorkerRole): Promise<{
  child: ChildProcess;
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
      env: {
        ...process.env,
        BILLING_PROBE_WORKER: "1",
        BILLING_PROBE_WORKER_ROLE: role,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out starting ${role} probe worker:\n${output}`)),
      15_000,
    );
    const onOutput = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/BILLING_RESTART_PROBE_READY:(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    };
    child.stdout?.on("data", onOutput);
    child.stderr?.on("data", (chunk: Buffer) => {
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
          new Error(`${role} probe worker exited before readiness (${code ?? signal}):\n${output}`),
        );
      }
    });
  });
  return { child, baseUrl: `http://127.0.0.1:${port}/api` };
}

async function runCrossProcessOrderingProbe(
  lifecycleEventIdBase: string,
  transferEventIdBase: string,
  sourceId: string,
  destinationId: string,
): Promise<void> {
  const providerDelayMs = Number(
    process.env.BILLING_RESTART_CROSS_PROCESS_PROVIDER_DELAY_MS ?? "0",
  );
  assert.ok(Number.isInteger(providerDelayMs) && providerDelayMs > 0);
  const tightOverlapDelayMs = Math.max(1, Math.floor(providerDelayMs / 4));
  const permutations = [
    {
      name: "lifecycle-old-transfer-new-transfer",
      order: ["lifecycle", "transfer-old", "transfer-new"],
    },
    {
      name: "old-transfer-lifecycle-new-transfer",
      order: ["transfer-old", "lifecycle", "transfer-new"],
    },
    {
      name: "new-transfer-old-transfer-lifecycle",
      order: ["transfer-new", "transfer-old", "lifecycle"],
    },
    {
      name: "old-transfer-new-transfer-lifecycle",
      order: ["transfer-old", "transfer-new", "lifecycle"],
    },
    {
      name: "lifecycle-new-transfer-old-transfer",
      order: ["lifecycle", "transfer-new", "transfer-old"],
    },
    {
      name: "new-transfer-lifecycle-old-transfer",
      order: ["transfer-new", "lifecycle", "transfer-old"],
    },
  ] as const;
  const allPermutations = [
    ...permutations,
    ...permutations.map((permutation) => ({ ...permutation, name: `${permutation.name}-tight` })),
  ];

  const [lifecycleWorker, oldTransferWorker, newTransferWorker] = await Promise.all([
    startProbeWorker("lifecycle"),
    startProbeWorker("transfer-old"),
    startProbeWorker("transfer-new"),
  ]);
  const workers = [lifecycleWorker.child, oldTransferWorker.child, newTransferWorker.child];
  const workersByRole = {
    lifecycle: lifecycleWorker,
    "transfer-old": oldTransferWorker,
    "transfer-new": newTransferWorker,
  } satisfies Record<ProbeWorkerRole, { child: ChildProcess; baseUrl: string }>;
  const post = async (baseUrl: string, event: Record<string, unknown>, delayMs: number) => {
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    const response = await fetch(`${baseUrl}/billing/revenuecat/webhook`, {
      method: "POST",
      headers: {
        authorization: "Bearer billing-webhook-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ event }),
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };

  try {
    for (const [index, permutation] of allPermutations.entries()) {
      const lifecycleEventId = `${lifecycleEventIdBase}-${permutation.name}-${index}`;
      const oldTransferEventId = `${transferEventIdBase}-old-${permutation.name}-${index}`;
      const newTransferEventId = `${transferEventIdBase}-new-${permutation.name}-${index}`;
      const lifecycleTimestamp = 30_000 + index * 20_000;
      const oldTransferTimestamp = lifecycleTimestamp + 10_000;
      const newTransferTimestamp = lifecycleTimestamp + 20_000;
      const events = {
        lifecycle: {
          id: lifecycleEventId,
          type: "EXPIRATION",
          app_user_id: destinationId,
          event_timestamp_ms: lifecycleTimestamp,
        },
        "transfer-old": {
          id: oldTransferEventId,
          type: "TRANSFER",
          app_user_id: destinationId,
          transferred_from: [sourceId],
          transferred_to: [destinationId],
          event_timestamp_ms: oldTransferTimestamp,
        },
        "transfer-new": {
          id: newTransferEventId,
          type: "TRANSFER",
          app_user_id: destinationId,
          transferred_from: [sourceId],
          transferred_to: [destinationId],
          event_timestamp_ms: newTransferTimestamp,
        },
      };
      const responseOrder: string[] = [];
      let responseContext: unknown = "not completed";
      let persistedContext: unknown = "not queried";
      let lockContext: unknown = "not queried";
      const plannedDeliveryOrder = permutation.order.join("->");
      const relevantTransferEventIds = new Set([oldTransferEventId, newTransferEventId]);
      const deliver = async (role: ProbeWorkerRole, delayMs: number) => {
        const worker = workersByRole[role];
        const response = await post(worker.baseUrl, events[role], delayMs);
        responseOrder.push(role);
        return response;
      };

      try {
        const deliveryGapMs = permutation.name.endsWith("-tight")
          ? tightOverlapDelayMs
          : Math.max(10, Math.floor(providerDelayMs / 3));
        const delays = new Map<ProbeWorkerRole, number>(
          permutation.order.map((role, orderIndex) => [role, orderIndex * deliveryGapMs]),
        );
        const [lifecycleResponse, oldTransferResponse, newTransferResponse] = await Promise.all([
          deliver("lifecycle", delays.get("lifecycle") ?? 0),
          deliver("transfer-old", delays.get("transfer-old") ?? 0),
          deliver("transfer-new", delays.get("transfer-new") ?? 0),
        ]);
        responseContext = {
          lifecycle: lifecycleResponse,
          oldTransfer: oldTransferResponse,
          newTransfer: newTransferResponse,
        };
        assert.equal(lifecycleResponse.status, 200);
        assert.equal(oldTransferResponse.status, 200);
        assert.equal(newTransferResponse.status, 200);
        assert.ok(["processed", "stale"].includes(String(lifecycleResponse.body.result)));
        assert.ok(["processed", "stale"].includes(String(oldTransferResponse.body.result)));
        assert.equal(newTransferResponse.body.result, "processed");

        const persisted = await db.execute(sql`
          SELECT id, membership, subscription_status, billing_event_id, billing_event_timestamp
          FROM tradify_users
          WHERE id IN (${sourceId}, ${destinationId})
          ORDER BY id
        `);
        persistedContext = persisted.rows;
        const audits = await db.execute(sql`
          SELECT id, details, created_at
          FROM tradify_admin_audit_events
          WHERE action = 'BILLING_TRANSFER_OUTCOME'
          ORDER BY created_at DESC
          LIMIT 100
        `);
        const transferAudits = audits.rows
          .filter((row) => {
            const details = row.details;
            return Boolean(
              details &&
              typeof details === "object" &&
              !Array.isArray(details) &&
              relevantTransferEventIds.has(String((details as Record<string, unknown>).eventId)),
            );
          })
          .map((row) => {
            const details = row.details as Record<string, unknown>;
            return {
              id: row.id,
              eventId: details.eventId,
              outcome: details.outcome,
              lock: details.lock,
              createdAt: row.created_at,
            };
          });
        lockContext = transferAudits.map((audit) => ({
          eventId: audit.eventId,
          outcome: audit.outcome,
          lock: audit.lock,
        }));
        const persistedById = new Map(persisted.rows.map((row) => [String(row.id), row]));
        assert.deepEqual(persistedById.get(destinationId), {
          id: destinationId,
          membership: "VIP",
          subscription_status: "ACTIVE",
          billing_event_id: newTransferEventId,
          billing_event_timestamp: String(newTransferTimestamp),
        });
        assert.deepEqual(persistedById.get(sourceId), {
          id: sourceId,
          membership: "Free",
          subscription_status: "EXPIRED",
          billing_event_id: newTransferEventId,
          billing_event_timestamp: String(newTransferTimestamp),
        });
        for (const eventId of [oldTransferEventId, newTransferEventId]) {
          const transferAudit = transferAudits.find((audit) => audit.eventId === eventId);
          assert.ok(transferAudit, `missing transfer audit for ${eventId}`);
          const lock = transferAudit?.lock;
          assert.ok(
            lock && typeof lock === "object" && !Array.isArray(lock),
            `missing lock diagnostics for ${eventId}`,
          );
          const lockDetails = lock as Record<string, unknown>;
          assert.ok(
            ["ACQUIRED", "WAITED"].includes(String(lockDetails.outcome)),
            `invalid lock outcome for ${eventId}`,
          );
          assert.equal(typeof lockDetails.waitMs, "number", `invalid lock wait for ${eventId}`);
          assert.ok(
            Number.isFinite(lockDetails.waitMs) && Number(lockDetails.waitMs) >= 0,
            `invalid lock wait for ${eventId}`,
          );
          assert.equal(
            lockDetails.participantCount,
            2,
            `invalid lock participant count for ${eventId}`,
          );
        }
      } catch (error) {
        let auditContext: unknown = "unavailable";
        try {
          const audits = await db.execute(sql`
            SELECT id, details, created_at
            FROM tradify_admin_audit_events
            WHERE action = 'BILLING_TRANSFER_OUTCOME'
            ORDER BY created_at DESC
            LIMIT 100
          `);
          const relevantAudits = audits.rows.filter((row) => {
            const details = row.details;
            return Boolean(
              details &&
              typeof details === "object" &&
              !Array.isArray(details) &&
              relevantTransferEventIds.has(String((details as Record<string, unknown>).eventId)),
            );
          });
          auditContext = relevantAudits.map((row) => ({
            id: row.id,
            details: row.details,
            createdAt: row.created_at,
          }));
          lockContext = relevantAudits.map((row) => {
            const details = row.details as Record<string, unknown>;
            return { eventId: details.eventId, outcome: details.outcome, lock: details.lock };
          });
        } catch (auditError) {
          auditContext = `audit query failed: ${auditError instanceof Error ? auditError.message : String(auditError)}`;
        }
        throw new Error(
          [
            `cross-process billing ordering failed for ${permutation.name}`,
            `plannedDeliveryOrder=${plannedDeliveryOrder}`,
            `responseOrder=${responseOrder.join("->") || "none"}`,
            `responses=${JSON.stringify(responseContext)}`,
            `persisted=${JSON.stringify(persistedContext)}`,
            `lockDiagnostics=${JSON.stringify(lockContext)}`,
            `audit=${JSON.stringify(auditContext)}`,
            error instanceof Error ? error.message : String(error),
          ].join("; "),
          { cause: error },
        );
      }
    }
  } finally {
    for (const worker of workers) worker.kill("SIGTERM");
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            if (worker.exitCode !== null || worker.signalCode !== null) {
              resolve();
              return;
            }
            worker.once("exit", () => resolve());
          }),
      ),
    );
  }
}

async function runPersistenceProbe(): Promise<void> {
  const restartTransferEventId = process.env.BILLING_RESTART_TRANSFER_EVENT_ID;
  const restartTransferTimestampMs = Number(process.env.BILLING_RESTART_TRANSFER_TIMESTAMP_MS);
  const expiredTransferEventId = process.env.BILLING_EXPIRED_TRANSFER_EVENT_ID;
  const malformedTransferEventId = process.env.BILLING_MALFORMED_TRANSFER_EVENT_ID;
  const malformedExpiryTransferEventId = process.env.BILLING_MALFORMED_EXPIRY_TRANSFER_EVENT_ID;
  const malformedTimestampTransferEventId =
    process.env.BILLING_MALFORMED_TIMESTAMP_TRANSFER_EVENT_ID;
  const malformedTimestampDestinationId = process.env.BILLING_MALFORMED_TIMESTAMP_DESTINATION_ID;
  const malformedTimestampSourceId = process.env.BILLING_MALFORMED_TIMESTAMP_SOURCE_ID;
  const malformedTimestampSourceEmail = process.env.BILLING_MALFORMED_TIMESTAMP_SOURCE_EMAIL;
  const expectedDestinationId = process.env.BILLING_EXPECTED_DESTINATION_ID;
  const expectedSourceEmail = process.env.BILLING_EXPECTED_SOURCE_EMAIL;
  const emptySavedTransferEventId = process.env.BILLING_EMPTY_SAVED_TRANSFER_EVENT_ID;
  const duplicateSavedTransferEventId = process.env.BILLING_DUPLICATE_SAVED_TRANSFER_EVENT_ID;
  const overlappingSavedTransferEventId = process.env.BILLING_OVERLAPPING_SAVED_TRANSFER_EVENT_ID;
  const restartLifecycleEventId = process.env.BILLING_RESTART_LIFECYCLE_EVENT_ID;
  const restartCrossProcessTransferEventId =
    process.env.BILLING_RESTART_CROSS_PROCESS_TRANSFER_EVENT_ID;
  const restartCrossProcessSourceId = process.env.BILLING_RESTART_CROSS_PROCESS_SOURCE_ID;
  const restartCrossProcessDestinationId = process.env.BILLING_RESTART_CROSS_PROCESS_DESTINATION_ID;
  const restartRequestedUserId = process.env.BILLING_RESTART_REQUESTED_USER_ID;
  const restartRequestedEmail = process.env.BILLING_RESTART_REQUESTED_EMAIL;
  assert.ok(restartTransferEventId);
  assert.ok(Number.isFinite(restartTransferTimestampMs));
  assert.ok(expiredTransferEventId);
  assert.ok(malformedTransferEventId);
  assert.ok(malformedExpiryTransferEventId);
  assert.ok(malformedTimestampTransferEventId);
  assert.ok(malformedTimestampDestinationId);
  assert.ok(malformedTimestampSourceId);
  assert.ok(malformedTimestampSourceEmail);
  assert.ok(expectedDestinationId);
  assert.ok(expectedSourceEmail);
  assert.ok(emptySavedTransferEventId);
  assert.ok(duplicateSavedTransferEventId);
  assert.ok(overlappingSavedTransferEventId);
  assert.ok(restartLifecycleEventId);
  assert.ok(restartCrossProcessTransferEventId);
  assert.ok(restartCrossProcessSourceId);
  assert.ok(restartCrossProcessDestinationId);
  assert.ok(restartRequestedUserId);
  assert.ok(restartRequestedEmail);

  let providerLookups = 0;
  revenueCatBillingProvider.get = async (appUserId) => {
    providerLookups += 1;
    assert.ok([expectedDestinationId, malformedTimestampDestinationId].includes(appUserId));
    return {
      membership: "VIP",
      status: "ACTIVE",
      expiresAt: "2026-10-01T00:00:00.000Z",
      willRenew: true,
    };
  };

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function request(path: string, init?: RequestInit) {
    const result = await fetch(`${baseUrl}${path}`, init);
    return { status: result.status, body: (await result.json()) as Record<string, unknown> };
  }

  try {
    const adminFixture = await createTestAdmin(baseUrl);
    const adminAuth = { body: { token: adminFixture.token } };

    const restartedCollision = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `billing-restart-collision-${restartRequestedUserId}@example.test`,
        password: "billing-pass",
        userId: restartRequestedUserId,
      }),
    });
    assert.equal(restartedCollision.status, 409);
    assert.equal(restartedCollision.body.error, "USER_ID_IN_USE");

    const originalAuth = await request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: restartRequestedEmail,
        password: "billing-pass",
      }),
    });
    assert.equal(originalAuth.status, 200);
    const originalAuthorization = {
      authorization: `Bearer ${String(originalAuth.body.token)}`,
    };
    const originalProfile = await request("/user/profile", {
      headers: originalAuthorization,
    });
    assert.equal(originalProfile.status, 200);
    assert.deepEqual(
      {
        id: originalProfile.body.id,
        email: originalProfile.body.email,
      },
      {
        id: restartRequestedUserId,
        email: restartRequestedEmail,
      },
    );
    const originalStatus = await request("/membership/status", {
      headers: originalAuthorization,
    });
    assert.equal(originalStatus.status, 200);
    assert.equal(originalStatus.body.membership, "Free");
    assert.equal(originalStatus.body.billingStatus, "TRIALING");
    assert.deepEqual(originalStatus.body.entitlements, []);
    assert.equal(originalStatus.body.willRenew, false);
    assert.equal(providerLookups, 0);

    await runCrossProcessOrderingProbe(
      restartLifecycleEventId,
      restartCrossProcessTransferEventId,
      restartCrossProcessSourceId,
      restartCrossProcessDestinationId,
    );

    const billingTransfers = await request("/admin/billing/transfers", {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    });
    assert.equal(billingTransfers.status, 200);

    const pending = (billingTransfers.body.pending as Array<Record<string, unknown>>).find(
      (entry) => entry.eventId === restartTransferEventId,
    );
    assert.deepEqual(
      pending && {
        destinationAppUserIds: pending.destinationAppUserIds,
        transferTimestamp: pending.transferTimestamp,
      },
      {
        destinationAppUserIds: [expectedDestinationId],
        transferTimestamp: new Date(restartTransferTimestampMs).toISOString(),
      },
    );
    const malformedTimestampPending = (
      billingTransfers.body.pending as Array<Record<string, unknown>>
    ).find((entry) => entry.eventId === malformedTimestampTransferEventId);
    assert.deepEqual(
      malformedTimestampPending && {
        destinationAppUserIds: malformedTimestampPending.destinationAppUserIds,
        transferTimestamp: malformedTimestampPending.transferTimestamp,
      },
      {
        destinationAppUserIds: [malformedTimestampDestinationId],
        transferTimestamp: null,
      },
    );
    assert.equal(
      (billingTransfers.body.pending as Array<Record<string, unknown>>).some(
        (entry) => entry.eventId === expiredTransferEventId,
      ),
      false,
    );
    assert.equal(
      (billingTransfers.body.pending as Array<Record<string, unknown>>).some(
        (entry) => entry.eventId === malformedTransferEventId,
      ),
      false,
    );
    assert.equal(
      (billingTransfers.body.pending as Array<Record<string, unknown>>).some(
        (entry) => entry.eventId === malformedExpiryTransferEventId,
      ),
      false,
    );
    for (const malformedEventId of [
      emptySavedTransferEventId,
      duplicateSavedTransferEventId,
      overlappingSavedTransferEventId,
    ]) {
      assert.equal(
        (billingTransfers.body.pending as Array<Record<string, unknown>>).some(
          (entry) => entry.eventId === malformedEventId,
        ),
        false,
        `malformed saved transfer ${malformedEventId} is not pending`,
      );
    }

    const outcomes = billingTransfers.body.outcomes as Array<Record<string, unknown>>;
    const originalTransferAudit = outcomes.find((entry) => {
      const details = entry.details as Record<string, unknown>;
      return details?.eventId === restartTransferEventId && details.outcome === "processed";
    });
    assert.ok(originalTransferAudit);
    assert.equal(
      outcomes.some((entry) => {
        const details = entry.details as Record<string, unknown>;
        return details?.eventId === restartTransferEventId && details.outcome === "processed";
      }),
      true,
    );
    assert.equal(
      outcomes.some((entry) => {
        const details = entry.details as Record<string, unknown>;
        return details?.eventId === expiredTransferEventId && details.outcome === "processed";
      }),
      true,
    );

    const destinationAuth = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `billing-restart-destination-${expectedDestinationId}@example.test`,
        password: "billing-pass",
        userId: expectedDestinationId,
      }),
    });
    assert.equal(destinationAuth.status, 201);
    assert.equal((destinationAuth.body.user as Record<string, unknown>).id, expectedDestinationId);
    const destinationStatus = await request("/membership/status", {
      headers: { authorization: `Bearer ${String(destinationAuth.body.token)}` },
    });
    assert.equal(destinationStatus.status, 200);
    assert.equal(destinationStatus.body.membership, "VIP");
    assert.equal(destinationStatus.body.billingStatus, "ACTIVE");
    assert.equal(destinationStatus.body.willRenew, true);
    assert.equal(destinationStatus.body.expiresAt, "2026-10-01T00:00:00.000Z");
    assert.deepEqual(destinationStatus.body.entitlements, [
      "REALTIME_SIGNALS",
      "DGV8_CHART_LEVELS",
      "UNLIMITED_ALERTS",
    ]);
    assert.equal(providerLookups, 1);

    const malformedTimestampDestinationAuth = await request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: `billing-malformed-timestamp-destination-${malformedTimestampDestinationId}@example.test`,
        password: "billing-pass",
        userId: malformedTimestampDestinationId,
      }),
    });
    assert.equal(malformedTimestampDestinationAuth.status, 201);
    assert.equal(malformedTimestampDestinationAuth.body.recovery, "recovered");
    const malformedTimestampDestinationStatus = await request("/membership/status", {
      headers: { authorization: `Bearer ${String(malformedTimestampDestinationAuth.body.token)}` },
    });
    assert.equal(malformedTimestampDestinationStatus.status, 200);
    assert.equal(malformedTimestampDestinationStatus.body.membership, "VIP");
    assert.equal(malformedTimestampDestinationStatus.body.billingStatus, "ACTIVE");
    assert.equal(malformedTimestampDestinationStatus.body.willRenew, true);
    assert.equal(malformedTimestampDestinationStatus.body.expiresAt, "2026-10-01T00:00:00.000Z");
    assert.equal(providerLookups, 2);

    const sourceAuth = await request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: expectedSourceEmail, password: "billing-pass" }),
    });
    assert.equal(sourceAuth.status, 200);
    const sourceStatus = await request("/membership/status", {
      headers: { authorization: `Bearer ${String(sourceAuth.body.token)}` },
    });
    assert.equal(sourceStatus.body.membership, "Free");
    assert.equal(sourceStatus.body.billingStatus, "EXPIRED");
    assert.deepEqual(sourceStatus.body.entitlements, []);

    const malformedTimestampSourceAuth = await request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: malformedTimestampSourceEmail, password: "billing-pass" }),
    });
    assert.equal(malformedTimestampSourceAuth.status, 200);
    const malformedTimestampSourceStatus = await request("/membership/status", {
      headers: { authorization: `Bearer ${String(malformedTimestampSourceAuth.body.token)}` },
    });
    assert.equal(malformedTimestampSourceStatus.body.membership, "Free");
    assert.equal(malformedTimestampSourceStatus.body.billingStatus, "EXPIRED");
    assert.deepEqual(malformedTimestampSourceStatus.body.entitlements, []);

    const pendingAfterRecovery = await db.execute(
      sql`SELECT event_id FROM tradify_revenuecat_transfers WHERE event_id = ${restartTransferEventId}`,
    );
    assert.deepEqual(pendingAfterRecovery.rows, []);
    const malformedTimestampPendingAfterRecovery = await db.execute(
      sql`SELECT event_id FROM tradify_revenuecat_transfers WHERE event_id = ${malformedTimestampTransferEventId}`,
    );
    assert.deepEqual(malformedTimestampPendingAfterRecovery.rows, []);

    const recoveredTransfers = await request("/admin/billing/transfers", {
      headers: { authorization: `Bearer ${String(adminAuth.body.token)}` },
    });
    assert.equal(recoveredTransfers.status, 200);
    assert.equal(
      (recoveredTransfers.body.pending as Array<Record<string, unknown>>).some(
        (entry) => entry.eventId === restartTransferEventId,
      ),
      false,
    );
    assert.equal(
      (recoveredTransfers.body.outcomes as Array<Record<string, unknown>>).some(
        (entry) => entry.id === originalTransferAudit.id,
      ),
      true,
    );
    const malformedTimestampTransferAudit = (
      recoveredTransfers.body.outcomes as Array<Record<string, unknown>>
    ).find((entry) => {
      const details = entry.details as Record<string, unknown>;
      return (
        details?.eventId === malformedTimestampTransferEventId && details.outcome === "processed"
      );
    });
    assert.ok(malformedTimestampTransferAudit);
    assert.equal(
      (malformedTimestampTransferAudit.details as Record<string, unknown>).transferTimestamp,
      null,
    );
    assert.deepEqual(
      (malformedTimestampTransferAudit.details as Record<string, unknown>).previousAppUserIds,
      [malformedTimestampSourceId],
    );
    assert.deepEqual(
      (malformedTimestampTransferAudit.details as Record<string, unknown>).destinationAppUserIds,
      [malformedTimestampDestinationId],
    );
    const malformedTransferRow = await db.execute(
      sql`SELECT event_id FROM tradify_revenuecat_transfers WHERE event_id = ${malformedTransferEventId}`,
    );
    assert.deepEqual(malformedTransferRow.rows, []);
    const malformedExpiryTransferRow = await db.execute(
      sql`SELECT event_id FROM tradify_revenuecat_transfers WHERE event_id = ${malformedExpiryTransferEventId}`,
    );
    assert.deepEqual(malformedExpiryTransferRow.rows, []);
    for (const malformedEventId of [
      emptySavedTransferEventId,
      duplicateSavedTransferEventId,
      overlappingSavedTransferEventId,
    ]) {
      const malformedSavedTransferRow = await db.execute(
        sql`SELECT event_id FROM tradify_revenuecat_transfers WHERE event_id = ${malformedEventId}`,
      );
      assert.deepEqual(
        malformedSavedTransferRow.rows,
        [],
        `malformed saved transfer ${malformedEventId} removed`,
      );
    }
    console.log("RevenueCat billing restart persistence probe passed.");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
}

if (process.env.BILLING_REGISTRATION_COLLISION_WORKER === "1") {
  await runRegistrationCollisionWorker();
} else if (process.env.BILLING_PROBE_WORKER === "1") {
  await runProbeWorker();
} else {
  await runPersistenceProbe();
}
