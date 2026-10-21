import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { db, pool, tradifyUsers } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "./app";
import { updateCustomerState, type UserNotification } from "./tradify-runtime";

// Each stage exits before the next starts; no API runtime or cache is shared.
const stage = process.argv[2];
const email =
  process.env.NOTIFICATION_RESTART_TEST_EMAIL ??
  `notification-restart-${randomUUID()}@example.test`;
const password = "notification-restart-test-password";
const timestamp = 1_790_000_000_000;
const fixtures: UserNotification[] = [
  {
    id: "restart-unread-one",
    timestamp,
    timeLabel: "Just now",
    symbol: "XAUUSD",
    type: "MARKET_WARNING",
    title: "Market update",
    message: "A saved market warning",
    actionRequired: "Review your position",
    isRead: false,
  },
  {
    id: "restart-unread-two",
    timestamp: timestamp + 1,
    timeLabel: "Just now",
    symbol: "XAGUSD",
    type: "NEW_SETUP",
    title: "New opportunity",
    message: "A saved opportunity",
    signalId: "internal-signal-id",
    isRead: false,
  },
  {
    id: "restart-already-read",
    timestamp: timestamp + 2,
    timeLabel: "Just now",
    symbol: "EURUSD",
    type: "STATUS_CHANGE",
    title: "Opportunity updated",
    message: "A previously read notification",
    isRead: true,
  },
];

async function runStage() {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let token: string | undefined;
  async function request<T = unknown>(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, body: (await response.json()) as T };
  }
  try {
    const auth = await request<{ token: string; user: { id: string } }>(
      stage === "seed" ? "/auth/register" : "/auth/sign-in",
      "POST",
      { email, password },
    );
    assert.equal(auth.response.status, stage === "seed" ? 201 : 200);
    token = auth.body.token;
    if (stage === "seed") {
      await updateCustomerState(auth.body.user.id, (user) => {
        user.profile.membership = "Pro";
        user.membershipSource = "REVENUECAT";
        user.subscriptionStatus = "ACTIVE";
        user.notifications = fixtures.map((entry) => ({ ...entry }));
      });
    }

    const history = await request<UserNotification[]>("/user/notifications");
    assert.equal(history.response.status, 200);
    assert.equal(history.response.headers.get("cache-control"), "no-store");
    assert.equal(history.body.length, fixtures.length);
    for (const fixture of fixtures) {
      const entry = history.body.find((candidate: UserNotification) => candidate.id === fixture.id);
      assert.ok(entry, `Missing saved notification ${fixture.id}`);
      assert.deepEqual(entry, {
        id: fixture.id,
        timestamp: fixture.timestamp,
        timeLabel: entry.timeLabel,
        symbol: fixture.symbol,
        type: fixture.type,
        title: fixture.title,
        message: fixture.message,
        ...(fixture.actionRequired ? { actionRequired: fixture.actionRequired } : {}),
        isRead:
          stage === "verify-all" ||
          fixture.isRead ||
          (stage === "read-all" && fixture.id === fixtures[0]!.id),
        ...(fixture.signalId ? { signalId: "opportunity-xagusd" } : {}),
      });
      assert.equal(typeof entry.timeLabel, "string");
    }

    if (stage === "seed") {
      const read = await request(`/user/notifications/${fixtures[0]!.id}/read`, "PATCH");
      assert.equal(read.response.status, 200);
      assert.deepEqual(read.body, {
        ok: true,
        notification: {
          ...history.body.find((entry: UserNotification) => entry.id === fixtures[0]!.id),
          isRead: true,
        },
      });
      const missing = await request("/user/notifications/nonexistent/read", "PATCH");
      assert.equal(missing.response.status, 404);
      const missingBody = missing.body as {
        error?: unknown;
        message?: unknown;
        requestId?: unknown;
      };
      assert.equal(missingBody.error, "NOTIFICATION_NOT_FOUND");
      assert.equal(typeof missingBody.message, "string");
      assert.equal(typeof missingBody.requestId, "number");
    } else if (stage === "read-all") {
      const readAll = await request("/user/notifications/read-all", "POST");
      assert.equal(readAll.response.status, 200);
      assert.deepEqual(readAll.body, { ok: true });
    }
    console.log(`Notification restart stage ${stage} passed.`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
}

async function runRegression() {
  try {
    for (const nextStage of ["seed", "read-all", "verify-all"]) {
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
            fileURLToPath(import.meta.url),
            nextStage,
          ],
          {
            env: { ...process.env, NOTIFICATION_RESTART_TEST_EMAIL: email },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let output = "";
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error(`Notification restart stage ${nextStage} timed out.\n${output}`));
        }, 90_000);
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stderr.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.once("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        child.once("close", (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve();
          else reject(new Error(`Notification restart stage ${nextStage} failed.\n${output}`));
        });
      });
    }
    console.log(
      "Notification history, single-read, and read-all survived successive API process restarts.",
    );
  } finally {
    await db.delete(tradifyUsers).where(eq(tradifyUsers.email, email));
    await pool.end();
  }
}

if (stage) {
  assert.ok(["seed", "read-all", "verify-all"].includes(stage));
  await runStage();
} else {
  await runRegression();
}
