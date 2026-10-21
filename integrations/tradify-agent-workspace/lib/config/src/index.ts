function readString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function readNodeEnvironment(): string {
  return readString("NODE_ENV") ?? "development";
}

function readPositivePort(): string | undefined {
  const value = readString("PORT");
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return value;
}

/**
 * Server-side environment access. Values are read lazily so tests that
 * explicitly change process.env retain their existing behavior.
 */
export const env = {
  get nodeEnvironment(): string {
    return readNodeEnvironment();
  },
  get isProduction(): boolean {
    return readNodeEnvironment() === "production";
  },
  get port(): string | undefined {
    return readPositivePort();
  },
  get databaseUrl(): string {
    const value = readString("DATABASE_URL");
    if (!value) throw new Error("DATABASE_URL must be set.");
    return value;
  },
  get runtimeDatabaseUrl(): string {
    const isProduction = readNodeEnvironment() === "production";
    const value = isProduction
      ? readString("DATABASE_URL")
      : (readString("NEON_DEVELOPMENT_DATABASE_URL") ??
        readString("NEON_DATABASE_URL") ??
        readString("DATABASE_URL"));
    if (!value) {
      throw new Error(
        isProduction
          ? "DATABASE_URL must be set for production."
          : "NEON_DEVELOPMENT_DATABASE_URL, NEON_DATABASE_URL, or DATABASE_URL must be set.",
      );
    }
    return value;
  },
  get logLevel(): string {
    return readString("LOG_LEVEL") ?? "info";
  },
  get sessionSecret(): string | undefined {
    return readString("SESSION_SECRET");
  },
  get mt5BridgeSecret(): string | undefined {
    if (readString("MT5_DEMO_DATABASE_NAME")) {
      if (readNodeEnvironment() !== "development") {
        throw new Error("The isolated MT5 demo bridge secret is available only in development.");
      }
      return readString("MT5_DEV_BRIDGE_SECRET");
    }
    return readString("MT5_BRIDGE_SECRET");
  },
  get eodhdApiKey(): string | undefined {
    return readString("EODHD_API_KEY");
  },
  get alphaVantageApiKey(): string | undefined {
    return readString("ALPHAVANTAGE_API_KEY");
  },
  get massiveApiKey(): string | undefined {
    return readString("MASSIVE_API_KEY");
  },
  get twelveDataApiKey(): string | undefined {
    return readString("TWELVE_DATA_API_KEY");
  },
  get twelveDataIngestionEnabled(): boolean {
    return process.env.TWELVE_DATA_INGESTION_ENABLED === "true";
  },
  get twelveDataMaxRequestsPerMinute(): string | undefined {
    return readString("TWELVE_DATA_MAX_REQUESTS_PER_MINUTE");
  },
  get passwordResetFromEmail(): string | undefined {
    return readString("TRADIFY_PASSWORD_RESET_FROM_EMAIL");
  },
  get adminPublicOrigin(): string | undefined {
    return readString("TRADIFY_ADMIN_PUBLIC_ORIGIN");
  },
  get revenueCatProjectId(): string | undefined {
    return readString("REVENUECAT_PROJECT_ID");
  },
  get revenueCatWebhookSecret(): string | undefined {
    return readString("REVENUECAT_WEBHOOK_SECRET");
  },
  get profileMarketSnapshotEnabled(): boolean {
    return process.env.TRADIFY_PROFILE_MARKET_SNAPSHOT === "1";
  },
  get testDelayUserAuditMs(): string | undefined {
    return readString("TRADIFY_TEST_DELAY_USER_AUDIT_MS");
  },
  get corsOrigins(): string[] {
    return (readString("TRADIFY_CORS_ORIGINS") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  },
  get replitDevDomain(): string | undefined {
    return readString("REPLIT_DEV_DOMAIN");
  },
  get replitInternalAppDomain(): string | undefined {
    return readString("REPLIT_INTERNAL_APP_DOMAIN");
  },
  get replitExpoDevDomain(): string | undefined {
    return readString("REPLIT_EXPO_DEV_DOMAIN");
  },
  get developmentMarketProxy(): {
    NODE_ENV: string;
    TRADIFY_MARKET_DATA_UPSTREAM_URL?: string;
  } {
    return {
      NODE_ENV: readNodeEnvironment(),
      ...(readString("TRADIFY_MARKET_DATA_UPSTREAM_URL")
        ? { TRADIFY_MARKET_DATA_UPSTREAM_URL: readString("TRADIFY_MARKET_DATA_UPSTREAM_URL") }
        : {}),
    };
  },
};
