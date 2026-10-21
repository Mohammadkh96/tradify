import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, tradifyStaffAccess } from "@workspace/db";
import { tradifyUsers } from "@workspace/db/schema";

// PostgreSQL rate-limit counters outlive a test process. Give each API test
// process its own client identity instead of sharing the loopback IP forever.
const testAuthAddress = crypto.randomUUID().replace(/-/g, "").slice(0, 28).match(/.{4}/g)!;
export const testAuthClientIp = `fd00:${testAuthAddress.join(":")}`;

/**
 * Admin routes are tested with an explicitly persisted test account. Never
 * depend on a public signup rule, configured email list, or shared preview
 * credential to obtain administrator access.
 */
export async function createTestAdmin(
  baseUrl: string,
  credentials: { email?: string; password?: string } = {},
): Promise<{ email: string; password: string; token: string; userId: string; role: "admin" }> {
  const email =
    credentials.email ?? `api-test-admin-${process.pid}-${crypto.randomUUID()}@example.test`;
  const password = credentials.password ?? `test-admin-${crypto.randomUUID()}`;
  const request = async (path: string, method: "POST", body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": testAuthClientIp,
      },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  };

  const registration = await request("/auth/register", "POST", { email, password });
  let auth = registration;
  if (registration.status === 409 && registration.body.error === "EMAIL_IN_USE") {
    auth = await request("/auth/sign-in", "POST", { email, password });
  }
  const user = auth.body.user as { id?: unknown } | undefined;
  const userId = typeof user?.id === "string" ? user.id : "";
  const token = typeof auth.body.token === "string" ? auth.body.token : "";
  if (auth.status !== 201 && auth.status !== 200) {
    throw new Error(`Test admin authentication failed with status ${auth.status}`);
  }
  if (!token || !userId)
    throw new Error("Test admin response did not include a user ID and session token");

  await db.update(tradifyUsers).set({ role: "admin" }).where(eq(tradifyUsers.id, userId));
  await db
    .insert(tradifyStaffAccess)
    .values({
      userId,
      role: "SUPER_ADMIN",
      active: true,
    })
    .onConflictDoUpdate({
      target: tradifyStaffAccess.userId,
      set: {
        role: "SUPER_ADMIN",
        customPermissions: [],
        active: true,
        rowVersion: sql`${tradifyStaffAccess.rowVersion} + 1`,
        updatedAt: new Date(),
      },
    });

  const currentUser = await fetch(`${baseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!currentUser.ok) throw new Error("Persisted test admin could not be reloaded");
  const currentUserBody = (await currentUser.json()) as { user?: { role?: unknown } };
  if (currentUserBody.user?.role !== "admin")
    throw new Error("Test admin role was not loaded from persistence");
  return { email, password, token, userId, role: "admin" };
}
