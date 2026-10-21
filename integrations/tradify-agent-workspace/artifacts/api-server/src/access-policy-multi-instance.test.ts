import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import { createTestAdmin } from "./test-admin";
import { CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS } from "./access-policy";

const tsxCliPath = fileURLToPath(
  new URL("../../../node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs", import.meta.url),
);
const serverScriptPath = fileURLToPath(new URL("./access-policy-test-server.ts", import.meta.url));
const customerEmail = `access-policy-multi-instance-${process.pid}-${Date.now()}@example.test`;

type Policy = {
  featureMinimumTiers: Record<string, string>;
  marketTiers: Record<string, string>;
  watchlistLimits: { Free: number; Pro: number; VIP: number | null };
};

type VersionedPolicy = Policy & { rowVersion: number };

type RunningInstance = {
  child: ChildProcess;
  baseUrl: string;
  output: string;
};

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
  return { status: response.status, body, headers: response.headers };
}

async function startInstance(): Promise<RunningInstance> {
  const child = spawn(process.execPath, [tsxCliPath, serverScriptPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`Timed out waiting for API test process to start.\n${output}`));
    }, 20_000);

    const finish = (error?: Error, instance?: RunningInstance) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(instance!);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/ACCESS_POLICY_TEST_SERVER_READY:(\d+)/);
      if (match) {
        finish(undefined, {
          child,
          baseUrl: `http://127.0.0.1:${match[1]}/api`,
          output,
        });
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      finish(
        new Error(
          `API test process exited before readiness (code=${code}, signal=${signal}).\n${output}`,
        ),
      );
    });
  });
}

async function stopInstance(instance: RunningInstance): Promise<void> {
  const { child } = instance;
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const forceKill = setTimeout(() => child.kill("SIGKILL"), 5_000);
    child.once("close", () => {
      clearTimeout(forceKill);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

function readPolicy(body: Record<string, unknown>): VersionedPolicy {
  return {
    featureMinimumTiers: body.featureMinimumTiers as Record<string, string>,
    marketTiers: body.marketTiers as Record<string, string>,
    watchlistLimits: body.watchlistLimits as VersionedPolicy["watchlistLimits"],
    rowVersion: body.rowVersion as number,
  };
}

async function readAdminPolicy(baseUrl: string, adminToken: string): Promise<VersionedPolicy> {
  const response = await request(baseUrl, "/admin/access-policy", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.status, 200, "administrator must be able to read the shared access policy");
  return readPolicy(response.body as Record<string, unknown>);
}

async function updateFeatureTier(
  baseUrl: string,
  adminToken: string,
  policy: VersionedPolicy,
  featureTier: string,
): Promise<VersionedPolicy> {
  const updatedPolicy: Policy = {
    featureMinimumTiers: { ...policy.featureMinimumTiers, priceAlerts: featureTier },
    marketTiers: { ...policy.marketTiers },
    watchlistLimits: { ...policy.watchlistLimits },
  };
  const response = await request(baseUrl, "/admin/access-policy", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ rowVersion: policy.rowVersion, ...updatedPolicy }),
  });
  assert.equal(response.status, 200, `administrator policy update to ${featureTier} must succeed`);
  const result = readPolicy(response.body as Record<string, unknown>);
  assert.equal(result.rowVersion, policy.rowVersion + 1);
  assert.equal(result.featureMinimumTiers.priceAlerts, featureTier);
  return result;
}

async function createAndRemoveAlert(
  baseUrl: string,
  customerToken: string,
  label: string,
): Promise<number> {
  const response = await request(baseUrl, "/user/alerts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      symbol: "USOIL",
      target: 75,
      condition: "ABOVE",
      label,
    }),
  });
  if (response.status === 201) {
    const alert = (response.body as { alert?: { id?: string } }).alert;
    assert.equal(typeof alert?.id, "string");
    const deleted = await request(baseUrl, `/user/alerts/${encodeURIComponent(alert!.id!)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(deleted.status, 200, "temporary access-policy alert must be removed");
  }
  return response.status;
}

async function waitForCustomerGate(
  baseUrl: string,
  customerToken: string,
  expectedStatus: 201 | 403,
  transition: string,
): Promise<void> {
  const startedAt = Date.now();
  const deadline = startedAt + CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS + 300;
  let observedStatus: number | undefined;

  while (Date.now() <= deadline) {
    observedStatus = await createAndRemoveAlert(
      baseUrl,
      customerToken,
      `Access policy propagation check ${transition}`,
    );
    if (observedStatus === expectedStatus) {
      assert.ok(
        Date.now() - startedAt <= CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS + 300,
        `customer gate ${transition} must refresh within the documented interval`,
      );
      return;
    }
    assert.ok(
      observedStatus === 201 || observedStatus === 403,
      `customer access check returned unexpected status ${observedStatus} during ${transition}`,
    );
    await delay(25);
  }
  assert.equal(
    observedStatus,
    expectedStatus,
    `customer gate ${transition} did not update within ${CUSTOMER_ACCESS_POLICY_REFRESH_INTERVAL_MS}ms`,
  );
}

async function run() {
  let instanceA: RunningInstance | undefined;
  let instanceB: RunningInstance | undefined;
  let adminToken: string | undefined;
  let originalPolicy: VersionedPolicy | undefined;
  let customerToken: string | undefined;

  try {
    instanceA = await startInstance();
    instanceB = await startInstance();

    const admin = await createTestAdmin(instanceA.baseUrl);
    adminToken = admin.token;
    const registration = await request(instanceA.baseUrl, "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        password: "access-policy-test-pass",
      }),
    });
    assert.equal(registration.status, 201);
    customerToken = String((registration.body as { token?: unknown }).token ?? "");
    assert.ok(customerToken, "registered customer must receive an authentication token");

    originalPolicy = await readAdminPolicy(instanceA.baseUrl, adminToken);
    const initialCustomerStatus = await request(instanceB.baseUrl, "/membership/status", {
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(initialCustomerStatus.status, 200);
    const initialCustomerPolicy = readPolicy(
      (initialCustomerStatus.body as { accessPolicy: Record<string, unknown> }).accessPolicy,
    );
    assert.equal(
      initialCustomerPolicy.rowVersion,
      originalPolicy.rowVersion,
      "second API process must load the current shared revision before the update",
    );

    const initiallyAllowed = originalPolicy.featureMinimumTiers.priceAlerts === "Free";
    const initialGateStatus = await createAndRemoveAlert(
      instanceB.baseUrl,
      customerToken,
      "Access policy initial gate check",
    );
    assert.equal(
      initialGateStatus,
      initiallyAllowed ? 201 : 403,
      "initial customer access must match the shared policy",
    );

    const newTier = initiallyAllowed ? "Pro" : "Free";
    let currentPolicy = await updateFeatureTier(
      instanceA.baseUrl,
      adminToken,
      originalPolicy,
      newTier,
    );
    await waitForCustomerGate(
      instanceB.baseUrl,
      customerToken,
      initiallyAllowed ? 403 : 201,
      `policy revision ${currentPolicy.rowVersion} (${newTier})`,
    );

    if (newTier !== "Pro") {
      currentPolicy = await updateFeatureTier(instanceA.baseUrl, adminToken, currentPolicy, "Pro");
      await waitForCustomerGate(
        instanceB.baseUrl,
        customerToken,
        403,
        `policy revision ${currentPolicy.rowVersion} (Pro)`,
      );
    }
    assert.equal(currentPolicy.featureMinimumTiers.priceAlerts, "Pro");

    await stopInstance(instanceA);
    instanceA = await startInstance();
    const policyAfterFirstRestart = await readAdminPolicy(instanceA.baseUrl, adminToken);
    assert.equal(policyAfterFirstRestart.rowVersion, currentPolicy.rowVersion);
    assert.equal(policyAfterFirstRestart.featureMinimumTiers.priceAlerts, "Pro");

    await stopInstance(instanceB);
    instanceB = await startInstance();
    const customerStatusAfterRestart = await request(instanceB.baseUrl, "/membership/status", {
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert.equal(customerStatusAfterRestart.status, 200);
    const customerPolicyAfterRestart = readPolicy(
      (customerStatusAfterRestart.body as { accessPolicy: Record<string, unknown> }).accessPolicy,
    );
    assert.equal(customerPolicyAfterRestart.rowVersion, currentPolicy.rowVersion);
    assert.equal(customerPolicyAfterRestart.featureMinimumTiers.priceAlerts, "Pro");
    assert.equal(
      await createAndRemoveAlert(
        instanceB.baseUrl,
        customerToken,
        "Access policy post-restart gate check",
      ),
      403,
      "restarted customer API process must continue enforcing the latest restrictive policy",
    );

    console.log(
      `Access policy propagation passed across two API processes; restart retained revision ${currentPolicy.rowVersion}.`,
    );
  } finally {
    if (instanceA && adminToken && originalPolicy) {
      try {
        const latest = await readAdminPolicy(instanceA.baseUrl, adminToken);
        if (latest.rowVersion !== originalPolicy.rowVersion) {
          const restore = await request(instanceA.baseUrl, "/admin/access-policy", {
            method: "PUT",
            headers: {
              authorization: `Bearer ${adminToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              rowVersion: latest.rowVersion,
              featureMinimumTiers: originalPolicy.featureMinimumTiers,
              marketTiers: originalPolicy.marketTiers,
              watchlistLimits: originalPolicy.watchlistLimits,
            }),
          });
          assert.equal(restore.status, 200, "test must restore the shared customer access policy");
        }
      } finally {
        if (instanceB) await stopInstance(instanceB);
        await stopInstance(instanceA);
        await pool.end();
      }
      return;
    }

    if (instanceB) await stopInstance(instanceB);
    if (instanceA) await stopInstance(instanceA);
    await pool.end();
  }
}

await run();
