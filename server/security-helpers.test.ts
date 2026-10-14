import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  canAccessUser,
  redactSensitiveFields,
  isRetiredAiPath,
  requireAdminSession,
  requireOwnUserParam,
  requireOwnUserQueryOrHeader,
  requireSessionAuth,
  retiredAiMiddleware,
  syncTokensMatch,
  toAdminUserRole,
  toClientUserRole,
} from "./security-helpers";
import { isRetiredAiRequest } from "@shared/retiredAi";

describe("user response projections", () => {
  const dbUser = {
    id: 5,
    userId: "trader@example.test",
    role: "TRADER",
    fullName: "Example Trader",
    subscriptionTier: "PRO",
    dashboardConfig: { layout: "compact" },
    password: "password-hash",
    syncToken: "mt5-secret",
    emailVerificationToken: "verify-secret",
    passwordResetToken: "reset-secret",
    unsubscribeToken: "unsubscribe-secret",
    stripeCustomerId: "cus_secret",
    stripeSubscriptionId: "sub_secret",
    paypalSubscriptionId: "paypal-secret",
    adminNotes: "internal only",
    adminTags: ["needs-review"],
  };

  it("keeps the account fields needed by the customer UI and removes credentials/provider ids", () => {
    const projected = toClientUserRole(dbUser)!;
    expect(projected).toMatchObject({
      userId: dbUser.userId,
      role: dbUser.role,
      subscriptionTier: dbUser.subscriptionTier,
      dashboardConfig: dbUser.dashboardConfig,
    });
    for (const secretField of [
      "password",
      "syncToken",
      "emailVerificationToken",
      "passwordResetToken",
      "unsubscribeToken",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "paypalSubscriptionId",
      "adminNotes",
      "adminTags",
    ]) {
      expect(projected).not.toHaveProperty(secretField);
    }
  });

  it("gives admin lists token-presence metadata, never the token value", () => {
    const projected = toAdminUserRole(dbUser);
    expect(projected.hasSyncToken).toBe(true);
    expect(projected).not.toHaveProperty("syncToken");
    expect(projected).not.toHaveProperty("password");
    expect(projected).not.toHaveProperty("stripeCustomerId");
    expect(projected.adminNotes).toBe("internal only");
  });

  it("redacts nested credential fields from historical admin audit data", () => {
    expect(redactSensitiveFields({
      action: "legacy update",
      details: {
        syncToken: "mt5-secret",
        passwordHash: "hash",
        stripeCustomerId: "cus_secret",
        stripeSubscriptionId: "sub_secret",
        paypalSubscriptionId: "paypal-secret",
        providerId: "provider-secret",
        keep: "visible",
        nested: [{ verificationToken: "verify-secret" }],
      },
    })).toEqual({
      action: "legacy update",
      details: {
        syncToken: "[REDACTED]",
        passwordHash: "[REDACTED]",
        stripeCustomerId: "[REDACTED]",
        stripeSubscriptionId: "[REDACTED]",
        paypalSubscriptionId: "[REDACTED]",
        providerId: "[REDACTED]",
        keep: "visible",
        nested: [{ verificationToken: "[REDACTED]" }],
      },
    });
  });
});

describe("user-boundary and MT5 token helpers", () => {
  it("allows only the session owner for customer-scoped reads", () => {
    expect(canAccessUser("trader@example.test", "trader@example.test")).toBe(true);
    expect(canAccessUser("trader@example.test", "other@example.test")).toBe(false);
    expect(canAccessUser(undefined, "trader@example.test")).toBe(false);
  });

  it("rejects ordinary users from admin routes but permits stored or explicitly approved admins", async () => {
    const app = express();
    const protectedHandler = vi.fn((_req, res) => res.json({ ok: true }));
    app.use((req, _res, next) => {
      (req as any).session = { userId: req.header("x-test-session") };
      next();
    });
    const adminOnly = requireAdminSession(
      async (userId) => userId === "stored-admin" ? "ADMIN" : "TRADER",
      async (userId) => userId === "approved-admin",
    );
    app.get("/api/admin/protected", adminOnly, protectedHandler);

    let server: Server | undefined;
    try {
      server = app.listen(0);
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test server port");
      const origin = `http://127.0.0.1:${address.port}`;
      expect((await fetch(`${origin}/api/admin/protected`)).status).toBe(401);
      expect((await fetch(`${origin}/api/admin/protected`, {
        headers: { "x-test-session": "ordinary-user" },
      })).status).toBe(403);
      expect((await fetch(`${origin}/api/admin/protected`, {
        headers: { "x-test-session": "stored-admin" },
      })).status).toBe(200);
      expect((await fetch(`${origin}/api/admin/protected`, {
        headers: { "x-test-session": "approved-admin" },
      })).status).toBe(200);
      expect(protectedHandler).toHaveBeenCalledTimes(2);
    } finally {
      if (server) await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
  });

  it("rejects anonymous role reads and cross-user MT5 status/snapshot access", async () => {
    const app = express();
    const protectedHandler = vi.fn((_req, res) => res.json({ ok: true }));
    app.use((req, _res, next) => {
      (req as any).session = { userId: req.header("x-test-session") };
      next();
    });
    app.get("/api/user/role", requireSessionAuth, requireOwnUserQueryOrHeader, protectedHandler);
    app.get("/api/mt5/status/:userId", requireOwnUserParam(), protectedHandler);
    app.get("/api/mt5/snapshots/:userId", requireOwnUserParam(), protectedHandler);

    let server: Server | undefined;
    try {
      server = app.listen(0);
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test server port");
      const origin = `http://127.0.0.1:${address.port}`;
      const anonymousRole = await fetch(`${origin}/api/user/role`);
      expect(anonymousRole.status).toBe(401);
      const mismatchedRole = await fetch(`${origin}/api/user/role?userId=other@example.test`, {
        headers: { "x-test-session": "owner@example.test" },
      });
      expect(mismatchedRole.status).toBe(403);
      const crossUserStatus = await fetch(`${origin}/api/mt5/status/other@example.test`, {
        headers: { "x-test-session": "owner@example.test" },
      });
      expect(crossUserStatus.status).toBe(403);
      const crossUserSnapshots = await fetch(`${origin}/api/mt5/snapshots/other@example.test`, {
        headers: { "x-test-session": "owner@example.test" },
      });
      expect(crossUserSnapshots.status).toBe(403);
      expect(protectedHandler).not.toHaveBeenCalled();
    } finally {
      if (server) await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
  });

  it("requires a non-empty exact sync token and compares equal-length tokens safely", () => {
    expect(syncTokensMatch("a".repeat(64), "a".repeat(64))).toBe(true);
    expect(syncTokensMatch("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(syncTokensMatch("", "anything")).toBe(false);
    expect(syncTokensMatch(null, "anything")).toBe(false);
    expect(syncTokensMatch("expected", "")).toBe(false);
  });
});

describe("retired AI endpoints", () => {
  it("blocks the known inference endpoints without retiring deterministic availability checks", () => {
    const retiredPaths = [
      "/api/ai/insights/user@example.test",
      "/api/ai/psychology-review/user@example.test",
      "/api/ai/instrument-analysis/user@example.test",
      "/api/trades/42/ai-tags",
      "/api/monthly-review/user@example.test",
      "/api/compliance/explain",
      "/api/education/ai-tutor",
      "/api/admin/marketing/generate/post",
      "/api/admin/marketing/smart-suggestions",
      "/api/admin/marketing/pipeline/run",
      "/api/admin/marketing/content/12/repurpose",
      "/api/admin/marketing/ad-strategy",
    ];
    retiredPaths.forEach((path) => expect(isRetiredAiPath(path), path).toBe(true));
    expect(isRetiredAiPath("/api/monthly-review/user@example.test/available")).toBe(false);
    expect(isRetiredAiRequest("GET", "/api/admin/marketing/playbooks")).toBe(false);
    expect(isRetiredAiRequest("GET", "/api/admin/marketing/funnel/stages")).toBe(false);
    expect(isRetiredAiRequest("POST", "/api/admin/marketing/funnel/generate")).toBe(true);
  });

  it("returns 410 before an inference handler can execute", async () => {
    const app = express();
    const handler = vi.fn((_req, res) => res.json({ invoked: true }));
    app.use(retiredAiMiddleware);
    app.post("/api/admin/marketing/smart-suggestions", handler);

    let server: Server | undefined;
    try {
      server = app.listen(0);
      await new Promise<void>((resolve) => server!.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No test server port");

      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/admin/marketing/smart-suggestions`,
        { method: "POST" },
      );
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ message: "AI features have been removed." });
      expect(handler).not.toHaveBeenCalled();
    } finally {
      if (server) await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()),
      );
    }
  });
});
