import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import { isRetiredAiRequest } from "@shared/retiredAi";
export { isRetiredAiPath, retiredAiEndpoint } from "@shared/retiredAi";

const CLIENT_USER_FIELDS = [
  "id",
  "userId",
  "role",
  "fullName",
  "termsAccepted",
  "riskAcknowledged",
  "subscriptionTier",
  "subscriptionStatus",
  "currentPlan",
  "renewalDate",
  "subscriptionProvider",
  "billingPeriod",
  "country",
  "phoneNumber",
  "timezone",
  "mustResetPassword",
  "emailVerified",
  "hasSeenTour",
  "foundingMember",
  "foundingMemberProExpiry",
  "dashboardConfig",
  "referralCode",
  "referredBy",
  "utmSource",
  "utmCampaign",
  "emailUnsubscribed",
  "language",
  "lastLoginAt",
  "createdAt",
  "updatedAt",
] as const;

const ADMIN_USER_FIELDS = [
  ...CLIENT_USER_FIELDS,
  "adminNotes",
  "adminTags",
] as const;

function pickFields<T extends Record<string, unknown>>(
  value: T,
  fields: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(value, field))
      .map((field) => [field, value[field]]),
  );
}

export function toClientUserRole(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  return value ? pickFields(value, CLIENT_USER_FIELDS) : null;
}

export function toAdminUserRole(
  value: Record<string, unknown>,
): Record<string, unknown> & { hasSyncToken: boolean } {
  return {
    ...pickFields(value, ADMIN_USER_FIELDS),
    hasSyncToken: typeof value.syncToken === "string" && value.syncToken.length > 0,
  };
}

const SENSITIVE_RESPONSE_KEY =
  /(?:password|token|secret|credential|access.?key|api.?key|authorization|session|(?:stripe|paypal)[a-z]*(?:id|key)|[a-z]*provider[a-z]*(?:id|key))/i;

export function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_RESPONSE_KEY.test(key) ? "[REDACTED]" : redactSensitiveFields(nested),
    ]),
  );
}

export function canAccessUser(
  sessionUserId: string | null | undefined,
  targetUserId: string | null | undefined,
): boolean {
  return Boolean(sessionUserId && targetUserId && sessionUserId === targetUserId);
}

export const requireSessionAuth: RequestHandler = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Session expired. Please log in." });
  }
  next();
};

export function requireAdminSession(
  getStoredRole: (userId: string) => Promise<string | null | undefined>,
  hasActiveAdminAccess: (userId: string) => Promise<boolean>,
): RequestHandler {
  return async (req, res, next) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Session expired" });
    }
    try {
      const role = await getStoredRole(userId);
      if (role === "OWNER" || role === "ADMIN" || (role && await hasActiveAdminAccess(userId))) {
        return next();
      }
      return res.status(403).json({ message: "Admin access required" });
    } catch (error) {
      return next(error);
    }
  };
}

export function requireOwnUserParam(paramName = "userId"): RequestHandler {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Session expired. Please log in." });
    }
    if (!canAccessUser(req.session.userId, req.params[paramName])) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export const requireOwnUserQueryOrHeader: RequestHandler = (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Session expired. Please log in." });
  }
  const requestedUserId =
    typeof req.query.userId === "string"
      ? req.query.userId
      : typeof req.headers["x-user-id"] === "string"
        ? req.headers["x-user-id"]
        : undefined;
  if (requestedUserId && !canAccessUser(req.session.userId, requestedUserId)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

export function syncTokensMatch(
  storedToken: unknown,
  providedToken: unknown,
): boolean {
  if (typeof storedToken !== "string" || typeof providedToken !== "string") {
    return false;
  }

  const expected = Buffer.from(storedToken.trim(), "utf8");
  const provided = Buffer.from(providedToken.trim(), "utf8");
  if (expected.length === 0 || expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export const retiredAiMiddleware: RequestHandler = (req, res, next) => {
  if (isRetiredAiRequest(req.method, req.path)) {
    return res.status(410).json({ message: "AI features have been removed." });
  }
  next();
};
