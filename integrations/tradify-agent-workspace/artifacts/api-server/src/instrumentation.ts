import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  // Keep error reporting opt-in; do not collect traces or user PII by default.
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV?.trim() || process.env.NODE_ENV || "production",
    tracesSampleRate: 0,
  });
}

export { Sentry };
