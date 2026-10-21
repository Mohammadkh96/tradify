import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  pool,
  tradifyAdminAuditEvents,
  tradifyMarketAuthorityTransitions,
  tradifyStaffAccess,
  tradifyStrategyAssignments,
  tradifyUsers,
} from "@workspace/db";
import { tradifyPasswordResetTokens } from "@workspace/db/schema";
import app from "./app";
import { createTestAdmin, testAuthClientIp } from "./test-admin";
import { getCatalog, recordAdminAudit } from "./tradify-runtime";
import { marketDataRegistry } from "./zip-engine/market/ProviderRegistry";
import { MT5_WATCHLIST_QUOTE_SYMBOLS } from "./zip-engine/market/MT5WatchlistSubscriptions";
import { revenueCatCatalogProvider } from "./routes/tradify";
import {
  PasswordResetEmailDeliveryError,
  passwordResetEmailProvider,
} from "./password-reset-email";

const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
const baseUrl = `http://127.0.0.1:${port}/api`;
const routeTestEmail = `route-test-user-${process.pid}@example.test`;
const portalOrigin = new URL(baseUrl).origin;
const membershipEstimateFixtureIdPrefix = `route-test-access-estimate-${process.pid}-${randomUUID()}`;
const membershipEstimateFixtureIds: string[] = [];

function createMembershipEstimateFixture(input: {
  key: string;
  membership: "Free" | "Pro" | "VIP";
  role?: string;
  status?: string;
  deletedAt?: string | null;
}) {
  const now = new Date().toISOString();
  const id = `${membershipEstimateFixtureIdPrefix}-${input.key}`;
  return {
    id,
    email: `${id}@example.test`,
    passwordHash: "test-only-not-a-login-hash",
    name: `Access estimate fixture ${input.key}`,
    accountSize: 10_000,
    riskPercent: 1,
    maxDailyLoss: 200,
    maxTrades: 4,
    aggressive: false,
    membership: input.membership,
    role: input.role ?? "user",
    status: input.status ?? "active",
    entitlements: [] as string[],
    createdAt: now,
    lastSeenAt: now,
    deletedAt: input.deletedAt ?? null,
    watchlist: [`ROUTE-ESTIMATE-${input.key.toUpperCase()}`],
  };
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", testAuthClientIp);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body, headers: response.headers };
}

try {
  const adminAuth = await createTestAdmin(baseUrl);
  const adminToken = adminAuth.token;
  const adminUser = adminAuth;
  assert.equal(adminUser.role, "admin");

  {
    const baselineResponse = await request("/admin/access-policy", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(baselineResponse.status, 200);
    const baselineCounts = (
      baselineResponse.body as {
        estimatedMembershipTierCounts: Record<"Free" | "Pro" | "VIP", number>;
      }
    ).estimatedMembershipTierCounts;
    const deletedAt = new Date().toISOString();
    const estimateFixtures = [
      createMembershipEstimateFixture({ key: "eligible-free", membership: "Free" }),
      createMembershipEstimateFixture({ key: "eligible-pro", membership: "Pro" }),
      createMembershipEstimateFixture({ key: "eligible-vip", membership: "VIP" }),
      createMembershipEstimateFixture({ key: "administrator", membership: "VIP", role: "admin" }),
      createMembershipEstimateFixture({ key: "staff", membership: "VIP" }),
      createMembershipEstimateFixture({ key: "suspended", membership: "VIP", status: "suspended" }),
      createMembershipEstimateFixture({ key: "banned", membership: "VIP", status: "banned" }),
      createMembershipEstimateFixture({ key: "deleted", membership: "VIP", deletedAt }),
    ];
    membershipEstimateFixtureIds.push(...estimateFixtures.map((fixture) => fixture.id));
    await db.insert(tradifyUsers).values(estimateFixtures);
    await db.insert(tradifyStaffAccess).values([
      {
        userId: `${membershipEstimateFixtureIdPrefix}-administrator`,
        role: "SUPER_ADMIN",
        active: true,
      },
      { userId: `${membershipEstimateFixtureIdPrefix}-staff`, role: "READ_ONLY", active: true },
    ]);

    const initialResponse = await request("/admin/access-policy", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(initialResponse.status, 200);
    const initialPolicy = initialResponse.body as {
      rowVersion: number;
      featureMinimumTiers: Record<string, string>;
      marketTiers: Record<string, string>;
      watchlistLimits: { Free: number; Pro: number; VIP: number | null };
      estimatedMembershipTierCounts: Record<"Free" | "Pro" | "VIP", number>;
      estimatedWatchlistSizeDistribution: Array<{
        membershipTier: "Free" | "Pro" | "VIP";
        savedSymbolCount: number;
        customerCount: number;
      }>;
    };
    assert.deepEqual(
      initialPolicy.estimatedMembershipTierCounts,
      {
        Free: baselineCounts.Free + 1,
        Pro: baselineCounts.Pro + 1,
        VIP: baselineCounts.VIP + 1,
      },
      "only the active, non-deleted customer fixture in each tier should increase the estimate",
    );
    assert.deepEqual(Object.keys(initialPolicy.estimatedMembershipTierCounts).sort(), [
      "Free",
      "Pro",
      "VIP",
    ]);
    const serializedEstimateResponse = JSON.stringify(initialResponse.body);
    for (const fixture of estimateFixtures) {
      assert.equal(
        serializedEstimateResponse.includes(fixture.id),
        false,
        "membership estimates must not expose account IDs",
      );
      assert.equal(
        serializedEstimateResponse.includes(fixture.email),
        false,
        "membership estimates must not expose account emails",
      );
    }

    const groupedMembershipCounts = await db
      .select({
        membership: tradifyUsers.membership,
        customerCount: count(),
      })
      .from(tradifyUsers)
      .leftJoin(
        tradifyStaffAccess,
        and(eq(tradifyStaffAccess.userId, tradifyUsers.id), eq(tradifyStaffAccess.active, true)),
      )
      .where(
        and(
          eq(tradifyUsers.role, "user"),
          eq(tradifyUsers.status, "active"),
          isNull(tradifyUsers.deletedAt),
          isNull(tradifyStaffAccess.userId),
        ),
      )
      .groupBy(tradifyUsers.membership);
    const expectedMembershipTierCounts = { Free: 0, Pro: 0, VIP: 0 };
    for (const row of groupedMembershipCounts) {
      const tier = row.membership === "Pro" || row.membership === "VIP" ? row.membership : "Free";
      expectedMembershipTierCounts[tier] += row.customerCount;
    }
    assert.deepEqual(initialPolicy.estimatedMembershipTierCounts, expectedMembershipTierCounts);
    const distributionCounts = { Free: 0, Pro: 0, VIP: 0 };
    for (const bucket of initialPolicy.estimatedWatchlistSizeDistribution) {
      assert.deepEqual(
        Object.keys(bucket).sort(),
        ["customerCount", "membershipTier", "savedSymbolCount"],
        "watchlist estimates must contain aggregates only, without customer identities",
      );
      distributionCounts[bucket.membershipTier] += bucket.customerCount;
    }
    assert.deepEqual(distributionCounts, expectedMembershipTierCounts);
    const savedLists = await db
      .select({
        membership: tradifyUsers.membership,
        watchlist: tradifyUsers.watchlist,
      })
      .from(tradifyUsers)
      .leftJoin(
        tradifyStaffAccess,
        and(eq(tradifyStaffAccess.userId, tradifyUsers.id), eq(tradifyStaffAccess.active, true)),
      )
      .where(
        and(
          eq(tradifyUsers.role, "user"),
          eq(tradifyUsers.status, "active"),
          isNull(tradifyUsers.deletedAt),
          isNull(tradifyStaffAccess.userId),
        ),
      );
    const expectedSizeBuckets = new Map<
      string,
      {
        membershipTier: "Free" | "Pro" | "VIP";
        savedSymbolCount: number;
        customerCount: number;
      }
    >();
    for (const customer of savedLists) {
      const membershipTier =
        customer.membership === "Pro" || customer.membership === "VIP"
          ? customer.membership
          : "Free";
      const savedSymbolCount = new Set(
        customer.watchlist.filter((symbol) => typeof symbol === "string" && symbol.length > 0),
      ).size;
      const key = `${membershipTier}:${savedSymbolCount}`;
      const bucket = expectedSizeBuckets.get(key);
      if (bucket) bucket.customerCount += 1;
      else expectedSizeBuckets.set(key, { membershipTier, savedSymbolCount, customerCount: 1 });
    }
    assert.deepEqual(
      initialPolicy.estimatedWatchlistSizeDistribution,
      [...expectedSizeBuckets.values()].sort(
        (left, right) =>
          ["Free", "Pro", "VIP"].indexOf(left.membershipTier) -
            ["Free", "Pro", "VIP"].indexOf(right.membershipTier) ||
          left.savedSymbolCount - right.savedSymbolCount,
      ),
      "watchlist size estimates must exactly match aggregate saved-symbol counts",
    );
    assert.equal(
      "id" in initialResponse.body,
      false,
      "the aggregate response must not expose customer IDs",
    );
    assert.equal(
      "email" in initialResponse.body,
      false,
      "the aggregate response must not expose customer email addresses",
    );
    const original = {
      featureMinimumTiers: { ...initialPolicy.featureMinimumTiers },
      marketTiers: { ...initialPolicy.marketTiers },
      watchlistLimits: { ...initialPolicy.watchlistLimits },
    };
    const headers = { authorization: `Bearer ${adminToken}`, "content-type": "application/json" };
    let updatedVersion: number | undefined;
    let temporaryAlertId: string | undefined;
    let addedEurUsdToWatchlist = false;
    let eurUsdWasAlreadySaved = false;
    try {
      const existingWatchlist = await request("/watchlist", { headers });
      assert.equal(existingWatchlist.status, 200);
      eurUsdWasAlreadySaved =
        Array.isArray(existingWatchlist.body) && existingWatchlist.body.includes("EURUSD");

      const changedPolicy = {
        rowVersion: initialPolicy.rowVersion,
        featureMinimumTiers: { ...original.featureMinimumTiers, priceAlerts: "Free" },
        marketTiers: { ...original.marketTiers, EURUSD: "Free" },
        watchlistLimits: { ...original.watchlistLimits, Free: 5 },
      };
      const update = await request("/admin/access-policy", {
        method: "PUT",
        headers,
        body: JSON.stringify(changedPolicy),
      });
      assert.equal(update.status, 200);
      updatedVersion = (update.body as { rowVersion: number }).rowVersion;
      assert.equal(updatedVersion, initialPolicy.rowVersion + 1);
      assert.equal(
        (update.body as { featureMinimumTiers: Record<string, string> }).featureMinimumTiers
          .priceAlerts,
        "Free",
      );

      const status = await request("/membership/status", {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(status.status, 200);
      assert.equal(
        (status.body as { accessPolicy: { featureMinimumTiers: Record<string, string> } })
          .accessPolicy.featureMinimumTiers.priceAlerts,
        "Free",
      );

      const newAlert = await request("/user/alerts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          symbol: "USOIL",
          target: 75,
          condition: "ABOVE",
          label: "Access policy test",
        }),
      });
      assert.equal(newAlert.status, 201);
      temporaryAlertId = (newAlert.body as { alert: { id: string } }).alert.id;

      if (!eurUsdWasAlreadySaved) {
        const addMarket = await request("/watchlist", {
          method: "POST",
          headers,
          body: JSON.stringify({ symbol: "EURUSD" }),
        });
        assert.equal(addMarket.status, 200);
        addedEurUsdToWatchlist = true;
      }

      const staleWrite = await request("/admin/access-policy", {
        method: "PUT",
        headers,
        body: JSON.stringify(changedPolicy),
      });
      assert.equal(staleWrite.status, 409);

      const support = await createTestAdmin(baseUrl);
      await db
        .update(tradifyStaffAccess)
        .set({ role: "SUPPORT", updatedAt: new Date() })
        .where(eq(tradifyStaffAccess.userId, support.userId));
      const supportRead = await request("/admin/access-policy", {
        headers: { authorization: `Bearer ${support.token}` },
      });
      assert.equal(supportRead.status, 200);
      const supportWrite = await request("/admin/access-policy", {
        method: "PUT",
        headers: { authorization: `Bearer ${support.token}`, "content-type": "application/json" },
        body: JSON.stringify({
          rowVersion: updatedVersion,
          featureMinimumTiers: changedPolicy.featureMinimumTiers,
          marketTiers: changedPolicy.marketTiers,
          watchlistLimits: changedPolicy.watchlistLimits,
        }),
      });
      assert.equal(supportWrite.status, 403);

      const audit = await db
        .select()
        .from(tradifyAdminAuditEvents)
        .where(eq(tradifyAdminAuditEvents.action, "ACCESS_POLICY_UPDATED"));
      assert.ok(
        audit.some(
          (entry) => (entry.details as { rowVersion?: number }).rowVersion === updatedVersion,
        ),
      );
    } finally {
      if (temporaryAlertId) {
        await request(`/user/alerts/${encodeURIComponent(temporaryAlertId)}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${adminToken}` },
        });
      }
      if (addedEurUsdToWatchlist) {
        await request("/watchlist/EURUSD", {
          method: "DELETE",
          headers: { authorization: `Bearer ${adminToken}` },
        });
      }
      if (updatedVersion !== undefined) {
        const latest = await request("/admin/access-policy", {
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const latestVersion = (latest.body as { rowVersion: number }).rowVersion;
        const restore = await request("/admin/access-policy", {
          method: "PUT",
          headers,
          body: JSON.stringify({ rowVersion: latestVersion, ...original }),
        });
        assert.equal(
          restore.status,
          200,
          "access policy test must restore the shared configuration",
        );
      }
    }
  }

  const deniedMarketAccess = await request("/admin/market-access");
  assert.equal(deniedMarketAccess.status, 401);
  const marketAccess = await request("/admin/market-access", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(marketAccess.status, 200);
  const accessRows = marketAccess.body as unknown as Array<{
    symbol: string;
    requiredTier: string;
    marketType: string;
  }>;
  const coreSymbols = new Set(getCatalog().map((item) => item.symbol));
  const expectedQuoteOnlySymbols = MT5_WATCHLIST_QUOTE_SYMBOLS.filter(
    (symbol) => !coreSymbols.has(symbol),
  );
  assert.equal(accessRows.length, coreSymbols.size + expectedQuoteOnlySymbols.length);
  assert.equal(new Set(accessRows.map((row) => row.symbol)).size, accessRows.length);
  const accessBySymbol = new Map(accessRows.map((row) => [row.symbol, row]));
  assert.equal(accessBySymbol.get("USOIL")?.requiredTier, "Free");
  assert.equal(accessBySymbol.get("BTCUSD")?.requiredTier, "Free");
  assert.equal(accessBySymbol.get("ETHUSD")?.requiredTier, "Free");
  assert.equal(accessBySymbol.get("EURUSD")?.requiredTier, "Pro");
  assert.deepEqual(accessBySymbol.get("NDX"), {
    symbol: "NDX",
    name: "Nasdaq 100 Index",
    requiredTier: "VIP",
    marketType: "QUOTE_ONLY",
  });
  const deniedMarketInventory = await request("/admin/market-inventory");
  assert.equal(deniedMarketInventory.status, 401);
  const marketInventoryResponse = await request("/admin/market-inventory", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(marketInventoryResponse.status, 200);
  const inventoryRows = marketInventoryResponse.body as unknown as Array<{
    symbol: string;
    catalogId: string;
    displaySymbol: string;
    description: string;
    provider: string;
    providerSymbol: string;
    requiredTier: string;
    marketType: string;
    strategySupported: boolean;
    strategyConfigured: boolean;
    strategyId: string | null;
    availableStrategies: string[];
    assignedStrategies: string[];
    enabled: boolean | null;
    visibleToUsers: boolean | null;
    archived: boolean;
    controlManaged: boolean;
    quoteAvailable: boolean | null;
    candlesAvailable: boolean | null;
    brokerSpec: Record<string, unknown> | null;
  }>;
  assert.equal(inventoryRows.length, accessRows.length);
  assert.equal(new Set(inventoryRows.map((row) => row.symbol)).size, inventoryRows.length);
  assert.deepEqual(
    inventoryRows.map((row) => row.symbol).sort(),
    [...coreSymbols, ...expectedQuoteOnlySymbols].sort(),
  );
  const inventoryBySymbol = new Map(inventoryRows.map((row) => [row.symbol, row]));
  const ndxInventory = inventoryBySymbol.get("NDX");
  assert.ok(ndxInventory);
  assert.equal(ndxInventory.marketType, "QUOTE_ONLY");
  assert.equal(ndxInventory.requiredTier, "VIP");
  assert.equal(ndxInventory.strategySupported, true);
  assert.equal(ndxInventory.strategyConfigured, false);
  assert.equal(ndxInventory.strategyId, null);
  assert.deepEqual(ndxInventory.availableStrategies, ["BBB"]);
  assert.deepEqual(ndxInventory.assignedStrategies, []);
  assert.equal(ndxInventory.providerSymbol, "NDX");
  assert.equal(ndxInventory.enabled, true);
  assert.equal(ndxInventory.visibleToUsers, true);
  assert.equal(ndxInventory.archived, false);
  assert.equal(ndxInventory.controlManaged, true);
  assert.equal(Object.hasOwn(ndxInventory, "brokerSpec"), true);

  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const ndxControlResponse = await request("/admin/symbols/NDX", { headers: adminHeaders });
  assert.equal(ndxControlResponse.status, 200);
  const ndxControl = ndxControlResponse.body as {
    symbol: string;
    enabled: boolean;
    visibleToUsers: boolean;
    archived: boolean;
    rowVersion: number;
  };
  assert.equal(ndxControl.symbol, "NDX");
  const initialNdxStatus = {
    enabled: ndxControl.enabled,
    visibleToUsers: ndxControl.visibleToUsers,
  };
  let archiveApplied = false;
  let temporaryAssignmentId: string | undefined;
  let temporaryAssignmentCreated = false;
  try {
    const assignmentsResponse = await request("/admin/assignments", { headers: adminHeaders });
    assert.equal(assignmentsResponse.status, 200);
    const existingNdxAssignment = (
      assignmentsResponse.body as unknown as Array<{ id: string; symbol: string }>
    ).find((assignment) => assignment.symbol === "NDX");
    if (existingNdxAssignment) {
      temporaryAssignmentId = existingNdxAssignment.id;
    } else {
      const strategiesResponse = await request("/admin/strategies", { headers: adminHeaders });
      assert.equal(strategiesResponse.status, 200);
      const bbb = (
        strategiesResponse.body as unknown as Array<{ id: string; version: string }>
      ).find((strategy) => strategy.id === "BBB");
      assert.ok(bbb);
      const assignmentResponse = await request("/admin/assignments", {
        method: "POST",
        headers: { ...adminHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          strategyId: "BBB",
          strategyVersion: bbb.version,
          symbol: "NDX",
          timeframe: "M15",
          enabled: false,
          isDefault: false,
          notes: "temporary exact-identity regression fixture",
        }),
      });
      assert.equal(assignmentResponse.status, 201);
      temporaryAssignmentId = (assignmentResponse.body as { id: string }).id;
      temporaryAssignmentCreated = true;
    }

    const archiveResponse = await request("/admin/symbols/NDX", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        archived: true,
        rowVersion: ndxControl.rowVersion,
        reason: "archive regression test",
      }),
    });
    assert.equal(archiveResponse.status, 200);
    archiveApplied = true;
    const archivedControl = archiveResponse.body as {
      symbol: string;
      enabled: boolean;
      visibleToUsers: boolean;
      archived: boolean;
      rowVersion: number;
    };
    assert.equal(archivedControl.symbol, "NDX");
    assert.equal(archivedControl.archived, true);
    assert.equal(archivedControl.enabled, false);
    assert.equal(archivedControl.visibleToUsers, false);

    const assignmentsAfterArchive = await request("/admin/assignments", { headers: adminHeaders });
    assert.equal(assignmentsAfterArchive.status, 200);
    assert.ok(
      (assignmentsAfterArchive.body as unknown as Array<{ id: string; symbol: string }>).some(
        (assignment) => assignment.id === temporaryAssignmentId && assignment.symbol === "NDX",
      ),
    );

    const restoreResponse = await request("/admin/symbols/NDX", {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({
        archived: false,
        rowVersion: archivedControl.rowVersion,
        reason: "restore regression test",
      }),
    });
    assert.equal(restoreResponse.status, 200);
    archiveApplied = false;
    const restoredControl = restoreResponse.body as {
      archived: boolean;
      enabled: boolean;
      visibleToUsers: boolean;
    };
    assert.equal(restoredControl.archived, false);
    assert.deepEqual(
      { enabled: restoredControl.enabled, visibleToUsers: restoredControl.visibleToUsers },
      initialNdxStatus,
    );
  } finally {
    if (archiveApplied) {
      const latest = await request("/admin/symbols/NDX", { headers: adminHeaders });
      if (latest.status === 200) {
        const control = latest.body as { rowVersion: number };
        await request("/admin/symbols/NDX", {
          method: "PATCH",
          headers: { ...adminHeaders, "content-type": "application/json" },
          body: JSON.stringify({
            archived: false,
            rowVersion: control.rowVersion,
            reason: "test cleanup",
          }),
        });
      }
    }
    if (temporaryAssignmentCreated && temporaryAssignmentId) {
      await db
        .delete(tradifyStrategyAssignments)
        .where(eq(tradifyStrategyAssignments.id, temporaryAssignmentId));
    }
  }

  const eurusdInventory = inventoryBySymbol.get("EURUSD");
  assert.ok(eurusdInventory);
  assert.equal(eurusdInventory.marketType, "STRATEGY");
  assert.equal(eurusdInventory.requiredTier, "Pro");
  assert.equal(eurusdInventory.strategySupported, true);
  assert.equal(typeof eurusdInventory.displaySymbol, "string");
  assert.equal(typeof eurusdInventory.description, "string");
  assert.equal(typeof eurusdInventory.provider, "string");
  assert.equal(typeof eurusdInventory.catalogId, "string");

  const legacyTransitionId = `route-test-legacy-authority-${process.pid}-${Date.now()}`;
  const legacyQueryParameterNames = [
    "api_key",
    "apikey",
    "apiKey",
    "key",
    "token",
    "access_token",
    "client_secret",
    "authorization",
    "signature",
    "subscription_key",
  ];
  const legacyUrlValues = legacyQueryParameterNames.map(
    (name, index) => `legacy-matrix-canary-${name}-${index}`,
  );
  const legacyAuthorizationCanary = "legacy-matrix-canary-authorization-header";
  const legacyNestedTokenCanary = "legacy-matrix-canary-nested-token";
  const legacyCredentialUrl = `https://legacy-provider.example.invalid/quote?${legacyQueryParameterNames
    .map((name, index) => `${name}=${legacyUrlValues[index]}`)
    .join("&")}&symbol=EURUSD`;
  const legacyHealthReason =
    "Provider was rate limited; authority remains blocked until freshness recovers.";
  const legacyObservedAt = Date.now();
  const legacyHealthEvidence = {
    reason: "NO_APPROVED_HEALTHY_PROVIDER",
    selected: null,
    candidates: [
      {
        providerId: "LEGACY_TWELVE_DATA",
        health: {
          health: "DEGRADED",
          reasons: [`Legacy provider request failed at ${legacyCredentialUrl}`, legacyHealthReason],
          observedAt: legacyObservedAt,
          seriesReadiness: {
            providerId: "LEGACY_TWELVE_DATA",
            canonicalSymbol: "EURUSD",
            timeframe: "M15",
            enoughHistoryLoaded: true,
            latestRequiredClosedBarPresent: true,
            continuityValid: false,
            fullSynchronizationComplete: true,
            freshnessValid: false,
            observedAt: legacyObservedAt,
          },
          metrics: {
            providerRequestHistory: [
              {
                endpoint: legacyCredentialUrl,
                headers: { authorization: `Bearer ${legacyAuthorizationCanary}` },
                query: { apiKey: legacyNestedTokenCanary },
                reason: `Legacy request failed at ${legacyCredentialUrl}`,
              },
            ],
          },
        },
      },
    ],
  };
  const legacyTransition = {
    id: legacyTransitionId,
    contextKey: "EURUSD:M15:DGV8",
    canonicalSymbol: "EURUSD",
    timeframe: "M15",
    strategyId: "DGV8",
    previousProviderId: "LEGACY_TWELVE_DATA",
    nextProviderId: null,
    reason: "NO_APPROVED_HEALTHY_PROVIDER",
    healthEvidence: legacyHealthEvidence,
    createdAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const originalGetProviderDiagnostics =
    marketDataRegistry.getProviderDiagnostics.bind(marketDataRegistry);
  await db.insert(tradifyMarketAuthorityTransitions).values(legacyTransition);
  try {
    const [storedLegacyTransition] = await db
      .select({ healthEvidence: tradifyMarketAuthorityTransitions.healthEvidence })
      .from(tradifyMarketAuthorityTransitions)
      .where(eq(tradifyMarketAuthorityTransitions.id, legacyTransitionId))
      .limit(1);
    assert.deepEqual(storedLegacyTransition?.healthEvidence, legacyHealthEvidence);

    // Keep this route regression test offline and prevent registry refresh work
    // from creating or updating unrelated provider records.
    marketDataRegistry.getProviderDiagnostics = async (context) => ({
      context,
      authority: {
        contextKey: `${context.canonicalSymbol}:${context.timeframe}:${context.strategyId}`,
        selectedProviderId: null,
        reason: "NO_APPROVED_HEALTHY_PROVIDER",
        candidates: [],
      },
      providers: [],
    });
    const marketMatrix = await request("/admin/market-data/matrix?symbol=EURUSD", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(marketMatrix.status, 200);

    const matrixJson = JSON.stringify(marketMatrix.body);
    for (const sensitiveValue of [
      ...legacyUrlValues,
      legacyAuthorizationCanary,
      legacyNestedTokenCanary,
    ]) {
      assert.equal(
        matrixJson.includes(sensitiveValue),
        false,
        "legacy provider credentials must not appear in admin matrix responses",
      );
    }
    const marketMatrixTransitions = (
      marketMatrix.body as { transitions: Array<Record<string, unknown>> }
    ).transitions;
    const returnedLegacyTransition = marketMatrixTransitions.find(
      (transition) => transition.id === legacyTransitionId,
    );
    assert.ok(returnedLegacyTransition, "matrix should include the synthetic legacy authority row");
    const returnedEvidence = returnedLegacyTransition.healthEvidence as {
      candidates: Array<{
        health: {
          reasons: string[];
          seriesReadiness: {
            enoughHistoryLoaded: boolean;
            continuityValid: boolean;
            fullSynchronizationComplete: boolean;
            freshnessValid: boolean;
          };
        };
      }>;
    };
    assert.equal(returnedEvidence.candidates[0].health.reasons[1], legacyHealthReason);
    assert.deepEqual(returnedEvidence.candidates[0].health.seriesReadiness, {
      providerId: "LEGACY_TWELVE_DATA",
      canonicalSymbol: "EURUSD",
      timeframe: "M15",
      enoughHistoryLoaded: true,
      latestRequiredClosedBarPresent: true,
      continuityValid: false,
      fullSynchronizationComplete: true,
      freshnessValid: false,
      observedAt: legacyObservedAt,
    });

    const [storedLegacyTransitionAfterRead] = await db
      .select({ healthEvidence: tradifyMarketAuthorityTransitions.healthEvidence })
      .from(tradifyMarketAuthorityTransitions)
      .where(eq(tradifyMarketAuthorityTransitions.id, legacyTransitionId))
      .limit(1);
    assert.deepEqual(
      storedLegacyTransitionAfterRead?.healthEvidence,
      legacyHealthEvidence,
      "serving legacy diagnostics must not rewrite the persisted historical row",
    );
  } finally {
    marketDataRegistry.getProviderDiagnostics = originalGetProviderDiagnostics;
    await db
      .delete(tradifyMarketAuthorityTransitions)
      .where(eq(tradifyMarketAuthorityTransitions.id, legacyTransitionId));
  }

  const userAuth = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: routeTestEmail, password: "route-pass" }),
  });
  assert.equal(userAuth.status, 201);
  const userToken = String(userAuth.body.token);
  const user = userAuth.body.user as { id: string; role: string };
  assert.equal(user.role, "user");

  const forbidden = await request("/admin/overview", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(forbidden.status, 403);
  const billingAuditBase = Date.now() + 10_000;
  const billingAuditOutcomes = ["processed", "duplicate", "stale", "ignored"] as const;
  for (const [index, outcome] of billingAuditOutcomes.entries()) {
    await recordAdminAudit({
      actorId: `route-test-revenuecat-${process.pid}`,
      actorEmail: "revenuecat-webhook",
      action: "BILLING_WEBHOOK_OUTCOME",
      details: {
        eventType: index === 3 ? "UNKNOWN" : "RENEWAL",
        outcome,
        eventId: `customer-sensitive-event-${index}`,
        appUserId: "customer-sensitive-user",
        payload: { app_user_id: "customer-sensitive-user" },
      },
      createdAt: new Date(billingAuditBase + index * 1_000).toISOString(),
    });
  }
  const billingAuditQuery = new URLSearchParams({
    action: "BILLING_WEBHOOK_OUTCOME",
    pageSize: "2",
    from: new Date(billingAuditBase - 1_000).toISOString(),
    to: new Date(billingAuditBase + billingAuditOutcomes.length * 1_000).toISOString(),
  });
  const forbiddenBillingAudit = await request(`/admin/audit-log?${billingAuditQuery}`, {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(forbiddenBillingAudit.status, 403);
  const billingAuditPageOne = await request(`/admin/audit-log?${billingAuditQuery}&page=1`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const billingAuditPageTwo = await request(`/admin/audit-log?${billingAuditQuery}&page=2`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(billingAuditPageOne.status, 200);
  assert.equal(billingAuditPageTwo.status, 200);
  const billingAuditEntries = [
    ...(billingAuditPageOne.body as unknown as Array<Record<string, unknown>>),
    ...(billingAuditPageTwo.body as unknown as Array<Record<string, unknown>>),
  ];
  assert.equal(billingAuditEntries.length, billingAuditOutcomes.length);
  assert.deepEqual(
    billingAuditEntries.map((entry) => (entry.details as Record<string, unknown>).outcome).sort(),
    [...billingAuditOutcomes].sort(),
  );
  for (const entry of billingAuditEntries) {
    assert.equal(entry.action, "BILLING_WEBHOOK_OUTCOME");
    assert.deepEqual(Object.keys(entry.details as Record<string, unknown>).sort(), [
      "eventType",
      "outcome",
    ]);
    assert.equal(JSON.stringify(entry).includes("customer-sensitive"), false);
  }
  for (const path of ["/admin/audit-log", "/admin/crm/audit-logs"]) {
    const invalidFrom = await request(`${path}?from=not-a-timestamp`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(invalidFrom.status, 400);
    const { requestId: invalidFromRequestId, ...invalidFromBody } = invalidFrom.body;
    assert.ok(Number.isSafeInteger(invalidFromRequestId));
    assert.deepEqual(invalidFromBody, {
      error: "INVALID_AUDIT_DATE",
      field: "from",
      message: "from must be a valid timestamp",
    });

    const invalidTo = await request(`${path}?to=not-a-timestamp`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(invalidTo.status, 400);
    const { requestId: invalidToRequestId, ...invalidToBody } = invalidTo.body;
    assert.ok(Number.isSafeInteger(invalidToRequestId));
    assert.deepEqual(invalidToBody, {
      error: "INVALID_AUDIT_DATE",
      field: "to",
      message: "to must be a valid timestamp",
    });

    const reversed = await request(
      `${path}?from=${encodeURIComponent(new Date(billingAuditBase + 2_000).toISOString())}&to=${encodeURIComponent(new Date(billingAuditBase).toISOString())}`,
      {
        headers: { authorization: `Bearer ${adminToken}` },
      },
    );
    assert.equal(reversed.status, 400);
    const { requestId: reversedRequestId, ...reversedBody } = reversed.body;
    assert.ok(Number.isSafeInteger(reversedRequestId));
    assert.deepEqual(reversedBody, {
      error: "INVALID_AUDIT_DATE_RANGE",
      message: "from must be earlier than or equal to to",
    });
  }
  const malformedBillingAuditBase = billingAuditBase + 10_000;
  const malformedBillingAuditDetails = [
    "customer-sensitive-malformed-string",
    ["customer-sensitive-malformed-array"],
    {
      eventType: "RENEWAL",
      outcome: "unrecognized",
      eventId: "customer-sensitive-malformed-event",
      appUserId: "customer-sensitive-malformed-user",
      payload: { app_user_id: "customer-sensitive-malformed-user" },
    },
  ] as const;
  for (const [index, details] of malformedBillingAuditDetails.entries()) {
    await recordAdminAudit({
      actorId: `route-test-malformed-revenuecat-${process.pid}`,
      actorEmail: "revenuecat-webhook",
      action: "BILLING_WEBHOOK_OUTCOME",
      details: details as unknown as Record<string, unknown>,
      createdAt: new Date(malformedBillingAuditBase + index * 1_000).toISOString(),
    });
  }
  const malformedBillingAuditQuery = new URLSearchParams({
    action: "BILLING_WEBHOOK_OUTCOME",
    actorId: `route-test-malformed-revenuecat-${process.pid}`,
    pageSize: "10",
    from: new Date(malformedBillingAuditBase - 1_000).toISOString(),
    to: new Date(
      malformedBillingAuditBase + malformedBillingAuditDetails.length * 1_000,
    ).toISOString(),
  });
  const malformedBillingAudit = await request(`/admin/audit-log?${malformedBillingAuditQuery}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(malformedBillingAudit.status, 200);
  const malformedBillingAuditEntries = malformedBillingAudit.body as unknown as Array<
    Record<string, unknown>
  >;
  assert.equal(malformedBillingAuditEntries.length, malformedBillingAuditDetails.length);
  assert.deepEqual(
    malformedBillingAuditEntries.map((entry) => entry.details),
    [{ eventType: "RENEWAL" }, { eventType: "UNKNOWN" }, { eventType: "UNKNOWN" }],
  );
  for (const entry of malformedBillingAuditEntries) {
    assert.equal(entry.action, "BILLING_WEBHOOK_OUTCOME");
    assert.ok(
      ["eventType", "outcome"].includes(
        Object.keys(entry.details as Record<string, unknown>)[0] ?? "",
      ),
    );
    assert.equal(JSON.stringify(entry).includes("customer-sensitive-malformed"), false);
  }
  const overview = await request("/admin/overview", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(overview.status, 200);
  const diagnostics = await request("/admin/diagnostics", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(diagnostics.status, 200);
  const diagnosticRows = diagnostics.body as unknown as Array<Record<string, unknown>>;
  const xauDiagnostic = diagnosticRows.find((row) => row.symbol === "XAUUSD");
  assert.ok(xauDiagnostic, "XAUUSD diagnostics should be present in the observed market set");
  assert.ok(Object.hasOwn(xauDiagnostic, "observedBrokerSymbol"));
  assert.ok(Object.hasOwn(xauDiagnostic, "configuredBrokerSymbol"));
  assert.ok(Array.isArray(xauDiagnostic.bridgeReadinessBlockers));
  assert.equal(typeof xauDiagnostic.tradingSessionsAccepted, "boolean");
  assert.equal(typeof xauDiagnostic.allActiveM15SyncComplete, "boolean");
  assert.ok(
    ["BRIDGE_DISCONNECTED", "NOT_SUBSCRIBED", "SUBSCRIBED_UNVALIDATED"].includes(
      String(xauDiagnostic.syncState),
    ),
  );
  assert.notEqual(
    xauDiagnostic.syncState,
    "HEALTHY",
    "raw bridge availability must not be labeled strategy-trusted",
  );
  const forbiddenBillingTransfers = await request("/admin/billing/transfers", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(forbiddenBillingTransfers.status, 403);
  const billingTransfers = await request("/admin/billing/transfers", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(billingTransfers.status, 200);
  assert.ok(Array.isArray((billingTransfers.body as { pending: unknown[] }).pending));
  assert.ok(Array.isArray((billingTransfers.body as { outcomes: unknown[] }).outcomes));
  const originalCatalogGet = revenueCatCatalogProvider.get;
  const catalogFixture = {
    fetchedAt: "2026-10-06T12:00:00.000Z",
    currentOffering: {
      id: "offering-test",
      displayName: "Tradify Memberships",
      lookupKey: "default",
    },
    products: [
      {
        packageId: "package-test",
        packageName: "Pro Monthly",
        productId: "product-test",
        productDisplayName: "Tradify Pro Monthly",
        storeType: "app_store",
        storeName: "Signals iOS",
        storeProductIdentifier: "tradify_pro_monthly",
        productState: "active",
        indicativePrice: null,
        priceUnavailableReason: "STORE_CREDENTIALS_MISSING" as const,
      },
    ],
  };
  try {
    revenueCatCatalogProvider.get = async () => catalogFixture;
    const forbiddenCatalog = await request("/admin/billing/catalog", {
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(forbiddenCatalog.status, 403);
    const catalog = await request("/admin/billing/catalog", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(catalog.status, 200);
    assert.deepEqual(catalog.body, catalogFixture);
    assert.equal(catalog.headers.get("cache-control"), "private, no-store");

    revenueCatCatalogProvider.get = async () => {
      throw new Error("provider unavailable");
    };
    const unavailableCatalog = await request("/admin/billing/catalog", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(unavailableCatalog.status, 503);
    assert.equal(unavailableCatalog.body.error, "REVENUECAT_CATALOG_UNAVAILABLE");
    assert.equal(unavailableCatalog.body.message, "The request could not be completed. Try again later.");
    assert.ok(Number.isSafeInteger(unavailableCatalog.body.requestId));
  } finally {
    revenueCatCatalogProvider.get = originalCatalogGet;
  }
  const crmSummary = await request("/admin/crm/summary", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(crmSummary.status, 200);
  assert.equal("pricing" in crmSummary.body, false, "CRM summary must not invent plan prices");

  const updated = await request(`/admin/users/${user.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Updated customer" }),
  });
  assert.equal(updated.status, 200);
  assert.equal((updated.body.user as { name: string }).name, "Updated customer");
  const generalMembershipChange = await request(`/admin/users/${user.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ membership: "Pro", entitlements: ["REALTIME_SIGNALS"] }),
  });
  assert.equal(generalMembershipChange.status, 400);
  assert.equal(generalMembershipChange.body.error, "USE_DEDICATED_MEMBERSHIP_ENDPOINT");

  const unconfirmedUpgrade = await request("/membership/upgrade", {
    method: "POST",
    headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
    body: JSON.stringify({ membership: "VIP" }),
  });
  assert.equal(unconfirmedUpgrade.status, 409);
  assert.equal((unconfirmedUpgrade.body as { error: string }).error, "BILLING_CHECKOUT_REQUIRED");

  const membership = await request("/membership/status", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal((membership.body as { membership: string }).membership, "Free");
  assert.equal((membership.body as { source: string }).source, "UNKNOWN");
  assert.deepEqual((membership.body as { entitlements: string[] }).entitlements, []);
  assert.equal((membership.body as { provider: string }).provider, "REVENUECAT");
  const initialVersion = Number((updated.body.user as { version: number }).version);
  const detail = await request(`/admin/crm/users/${user.id}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(detail.status, 200);
  assert.equal((detail.body as { id: string }).id, user.id);
  assert.ok(Array.isArray((detail.body as { auditLog: unknown[] }).auditLog));
  const trades = await request(`/admin/crm/users/${user.id}/trades`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(trades.status, 200);
  assert.ok(Array.isArray((trades.body as { trades: unknown[] }).trades));
  const auditHistory = await request(`/admin/crm/users/${user.id}/audit-logs`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditHistory.status, 200);
  assert.ok(Array.isArray(auditHistory.body));
  const addedNote = await request(`/admin/users/${user.id}/notes`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ category: "SUPPORT", body: "Reviewed customer setup." }),
  });
  assert.equal(addedNote.status, 201);
  assert.equal(addedNote.body.body, "Reviewed customer setup.");

  const missingReason = await request(`/admin/crm/users/${user.id}/membership`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ membership: "VIP", version: initialVersion }),
  });
  assert.equal(missingReason.status, 400);
  assert.equal((missingReason.body as { error: string }).error, "REASON_REQUIRED");
  const membershipOverride = await request(`/admin/crm/users/${user.id}/membership`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      membership: "Free",
      subscriptionStatus: "TRIALING",
      trialDays: 14,
      reason: "Route test trial",
      version: initialVersion,
    }),
  });
  assert.equal(membershipOverride.status, 200);
  const membershipUser = membershipOverride.body.user as {
    version: number;
    membership: string;
    membershipSource: string;
    subscriptionStatus: string;
    trialEndsAt?: string;
    overrideEndsAt?: string;
    entitlements: string[];
  };
  assert.equal(membershipUser.membership, "Free");
  assert.equal(membershipUser.membershipSource, "ADMIN_OVERRIDE");
  assert.deepEqual(membershipUser.entitlements, []);
  assert.equal(membershipUser.subscriptionStatus, "TRIALING");
  assert.ok(membershipUser.trialEndsAt && Date.parse(membershipUser.trialEndsAt) > Date.now());
  assert.ok(
    membershipUser.overrideEndsAt && Date.parse(membershipUser.overrideEndsAt) > Date.now(),
  );

  const proTierOverride = await request(`/admin/crm/users/${user.id}/membership`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      membership: "Pro",
      reason: "Route test tier change",
      version: membershipUser.version,
    }),
  });
  assert.equal(proTierOverride.status, 200);
  const proTierUser = proTierOverride.body.user as {
    version: number;
    membership: string;
    membershipSource: string;
  };
  assert.equal(proTierUser.membership, "Pro");
  assert.equal(proTierUser.membershipSource, "ADMIN_OVERRIDE");
  const customerMembershipAfterAdminChange = await request("/membership/status", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(customerMembershipAfterAdminChange.status, 200);
  assert.equal(
    (customerMembershipAfterAdminChange.body as { membership: string }).membership,
    "Pro",
  );
  assert.equal(
    (customerMembershipAfterAdminChange.body as { source: string }).source,
    "ADMIN_OVERRIDE",
  );

  const entitlementOverride = await request(`/admin/crm/users/${user.id}/entitlements`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      grants: ["CUSTOM_ALERTS"],
      denies: ["REALTIME_SIGNALS"],
      reason: "Route test access",
      version: proTierUser.version,
    }),
  });
  assert.equal(entitlementOverride.status, 200);
  const entitlementUser = entitlementOverride.body.user as {
    version: number;
    entitlements: string[];
  };
  assert.ok(entitlementUser.entitlements.includes("CUSTOM_ALERTS"));
  assert.ok(!entitlementUser.entitlements.includes("REALTIME_SIGNALS"));

  const customerRolePromotion = await request(`/admin/users/${user.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ role: "admin", version: entitlementUser.version }),
  });
  assert.equal(customerRolePromotion.status, 403);
  assert.equal(customerRolePromotion.body.error, "STAFF_ACCESS_MANAGED_SEPARATELY");

  const roleOverride = await request(`/admin/crm/users/${user.id}/role`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      role: "admin",
      reason: "Route test role",
      version: entitlementUser.version,
    }),
  });
  assert.equal(roleOverride.status, 403);
  assert.equal(roleOverride.body.error, "STAFF_ACCESS_MANAGED_SEPARATELY");
  const roleUser = await request(`/admin/crm/users/${user.id}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(
    (roleUser.body as { role: string }).role,
    "user",
    "customer role changes must not grant staff access",
  );
  const rolePromotionAccess = await request("/admin/staff", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(rolePromotionAccess.status, 403);

  const stateOverride = await request(`/admin/crm/users/${user.id}/account-state`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      status: "suspended",
      reason: "Route test state",
      version: entitlementUser.version,
    }),
  });
  assert.equal(stateOverride.status, 200);
  assert.equal((stateOverride.body.user as { status: string }).status, "suspended");
  const activeSessionAfterSuspension = await request("/membership/status", {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(activeSessionAfterSuspension.status, 403);
  assert.equal(activeSessionAfterSuspension.body.error, "USER_SUSPENDED");
  const filteredAudit = await request(
    `/admin/crm/audit-logs?targetUserId=${encodeURIComponent(user.id)}&pageSize=50`,
    { headers: { authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(filteredAudit.status, 200);
  assert.ok(
    (filteredAudit.body as unknown as unknown[]).some((entry: unknown) =>
      JSON.stringify(entry).includes("MEMBERSHIP_OVERRIDE"),
    ),
  );

  const paused = await request("/admin/engine/pause", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ reason: "Route test pause" }),
  });
  assert.equal(paused.status, 200);
  assert.equal((paused.body as { mode: string }).mode, "PAUSED_MANUAL");
  const resumed = await request("/admin/engine/resume", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resumed.status, 200);
  assert.equal((resumed.body as { mode: string }).mode, "ACTIVE");

  const audit = await request("/admin/audit-log", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(audit.status, 200);
  assert.ok(Array.isArray(audit.body));
  assert.ok(
    (audit.body as Array<{ action: string }>).some((entry) => entry.action === "USER_UPDATED"),
  );
  assert.ok(
    (audit.body as Array<{ action: string }>).some((entry) => entry.action === "ENGINE_PAUSED"),
  );
  assert.ok(
    (audit.body as Array<{ action: string }>).some((entry) => entry.action === "ENGINE_RESUMED"),
  );

  const staffTestEmail = `route-test-staff-${process.pid}@example.test`;
  const staffTestPassword = "staff-route-pass";
  const staffRegistration = await request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: staffTestEmail, password: staffTestPassword }),
  });
  assert.equal(staffRegistration.status, 201);
  const staffTestUser = staffRegistration.body.user as { id: string; role: string };
  const grantStaff = await request("/admin/staff", {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      userId: staffTestUser.id,
      role: "READ_ONLY",
      customPermissions: [],
      active: true,
      reason: "Route test staff grant",
    }),
  });
  assert.equal(grantStaff.status, 201);
  assert.equal((grantStaff.body as { role: string }).role, "READ_ONLY");
  assert.equal(
    staffTestUser.role,
    "user",
    "staff access must remain separate from the customer role",
  );
  const staffLogin = await fetch(`${baseUrl}/auth/admin-session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: portalOrigin },
    body: JSON.stringify({ email: staffTestEmail, password: staffTestPassword }),
  });
  assert.equal(staffLogin.status, 200);
  const staffCookieHeader = staffLogin.headers.get("set-cookie");
  assert.ok(staffCookieHeader);
  const staffCookie = staffCookieHeader.split(";", 1)[0];
  const readOnlyStaffList = await request("/admin/staff", { headers: { cookie: staffCookie } });
  assert.equal(readOnlyStaffList.status, 200);
  assert.ok(
    (readOnlyStaffList.body as unknown as Array<{ userId: string; role: string }>).some(
      (row) => row.userId === staffTestUser.id && row.role === "READ_ONLY",
    ),
  );
  const grantedRow = grantStaff.body as { rowVersion: number; role: string; userId: string };
  const supportGrant = await request(`/admin/staff/${encodeURIComponent(staffTestUser.id)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      role: "SUPPORT",
      customPermissions: [],
      active: true,
      rowVersion: grantedRow.rowVersion,
      reason: "Route test support permissions",
    }),
  });
  assert.equal(supportGrant.status, 200);
  const supportSession = await request("/auth/admin-session", { headers: { cookie: staffCookie } });
  assert.equal(supportSession.status, 200);
  const supportCapabilities = (
    supportSession.body as { staff: { role: string; capabilities: string[] } }
  ).staff;
  assert.equal(supportCapabilities.role, "SUPPORT");
  assert.ok(supportCapabilities.capabilities.includes("users.read"));
  assert.ok(!supportCapabilities.capabilities.includes("memberships.manage"));
  assert.ok(!supportCapabilities.capabilities.includes("payments.read"));
  const supportCustomerDetail = await request(`/admin/crm/users/${user.id}`, {
    headers: { cookie: staffCookie },
  });
  assert.equal(supportCustomerDetail.status, 200);
  const supportBilling = await request("/admin/billing/transfers", {
    headers: { cookie: staffCookie },
  });
  assert.equal(supportBilling.status, 403);
  const supportMembershipMutation = await request(`/admin/crm/users/${user.id}/membership`, {
    method: "PATCH",
    headers: { cookie: staffCookie, origin: portalOrigin, "content-type": "application/json" },
    body: JSON.stringify({ membership: "Pro", reason: "Support must not change memberships" }),
  });
  assert.equal(supportMembershipMutation.status, 403);

  const supportRow = supportGrant.body as { rowVersion: number };
  const financeGrant = await request(`/admin/staff/${encodeURIComponent(staffTestUser.id)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      role: "FINANCE",
      customPermissions: [],
      active: true,
      rowVersion: supportRow.rowVersion,
      reason: "Route test finance permissions",
    }),
  });
  assert.equal(financeGrant.status, 200);
  const financeSession = await request("/auth/admin-session", { headers: { cookie: staffCookie } });
  assert.equal(financeSession.status, 200);
  const financeCapabilities = (
    financeSession.body as { staff: { role: string; capabilities: string[] } }
  ).staff;
  assert.equal(financeCapabilities.role, "FINANCE");
  assert.ok(financeCapabilities.capabilities.includes("payments.read"));
  assert.ok(financeCapabilities.capabilities.includes("memberships.manage"));
  const financeBilling = await request("/admin/billing/transfers", {
    headers: { cookie: staffCookie },
  });
  assert.equal(financeBilling.status, 200);
  const financeCustomer = await request(`/admin/crm/users/${user.id}`, {
    headers: { cookie: staffCookie },
  });
  assert.equal(financeCustomer.status, 200);
  const financeMembershipMutation = await request(`/admin/crm/users/${user.id}/membership`, {
    method: "PATCH",
    headers: { cookie: staffCookie, origin: portalOrigin, "content-type": "application/json" },
    body: JSON.stringify({
      membership: "Pro",
      reason: "Finance membership capability test",
      version: (financeCustomer.body as { version: number }).version,
    }),
  });
  assert.equal(financeMembershipMutation.status, 200);
  assert.equal(
    (financeMembershipMutation.body.user as { membershipSource: string }).membershipSource,
    "ADMIN_OVERRIDE",
  );

  const financeRow = financeGrant.body as { rowVersion: number; role: string };
  const revokeStaff = await request(`/admin/staff/${encodeURIComponent(staffTestUser.id)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      role: financeRow.role,
      customPermissions: [],
      active: false,
      rowVersion: financeRow.rowVersion,
      reason: "Route test staff deactivation",
    }),
  });
  assert.equal(revokeStaff.status, 200);
  const inactiveStaffDenied = await request("/admin/staff", { headers: { cookie: staffCookie } });
  assert.equal(inactiveStaffDenied.status, 403);
  const inactiveStaffLogout = await request("/auth/admin-session", {
    method: "DELETE",
    headers: { cookie: staffCookie, origin: portalOrigin },
  });
  assert.equal(inactiveStaffLogout.status, 200, "inactive staff must still be able to log out");

  const portalLogin = await fetch(`${baseUrl}/auth/admin-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: portalOrigin,
    },
    body: JSON.stringify({ email: adminAuth.email, password: adminAuth.password }),
  });
  assert.equal(portalLogin.status, 200);
  const portalLoginBody = (await portalLogin.json()) as Record<string, unknown>;
  assert.equal(portalLoginBody.ok, true);
  assert.equal(
    "token" in portalLoginBody,
    false,
    "the browser response must not expose a bearer token",
  );
  const setCookie = portalLogin.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  assert.match(setCookie, /Path=\//i);
  const cookie = setCookie.split(";", 1)[0];
  const cookieToken = cookie.slice(cookie.indexOf("=") + 1);
  const claims = JSON.parse(
    Buffer.from(cookieToken.split(".")[0], "base64url").toString("utf8"),
  ) as {
    iat: number;
    exp: number;
  };
  assert.equal(claims.exp - claims.iat, 8 * 60 * 60 * 1000);

  const portalSession = await request("/auth/admin-session", { headers: { cookie } });
  assert.equal(portalSession.status, 200);
  assert.equal((portalSession.body.user as { role: string }).role, "admin");
  const portalOverview = await request("/admin/overview", { headers: { cookie } });
  assert.equal(portalOverview.status, 200);
  const csrfRejected = await request("/admin/engine/pause", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ reason: "Must be rejected without a same-origin request" }),
  });
  assert.equal(csrfRejected.status, 403);
  assert.equal(csrfRejected.body.error, "CSRF_REJECTED");

  const portalLogout = await request("/auth/admin-session", {
    method: "DELETE",
    headers: { cookie, origin: portalOrigin },
  });
  assert.equal(portalLogout.status, 200);
  assert.match(portalLogout.headers.get("set-cookie") ?? "", /Expires=Thu, 01 Jan 1970/i);
  const portalSessionAfterLogout = await request("/auth/admin-session", { headers: { cookie } });
  assert.equal(portalSessionAfterLogout.status, 401);

  const suspendedCustomerId = `${membershipEstimateFixtureIdPrefix}-suspended`;
  const originalResetIsConfigured = passwordResetEmailProvider.isConfigured;
  const originalSendResetEmail = passwordResetEmailProvider.send;
  const sentCustomerResetEmails: Array<{ to: string; token: string }> = [];
  passwordResetEmailProvider.isConfigured = () => true;
  passwordResetEmailProvider.send = async (to, token) => {
    sentCustomerResetEmails.push({ to, token });
  };
  try {
    const resetAdminSignIn = await request("/auth/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: adminAuth.email, password: adminAuth.password }),
    });
    assert.equal(resetAdminSignIn.status, 200);
    const resetAdminToken = String(resetAdminSignIn.body.token);
    const customerResetPath = `/admin/users/${encodeURIComponent(suspendedCustomerId)}/password-reset`;
    const customerResetForbidden = await request(customerResetPath, {
      method: "POST",
      headers: { authorization: `Bearer ${userToken}` },
    });
    assert.equal(
      customerResetForbidden.status,
      403,
      "customers cannot initiate another account's reset",
    );

    const staffResetTarget = await request(
      `/admin/users/${encodeURIComponent(adminUser.userId)}/password-reset`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${resetAdminToken}` },
      },
    );
    assert.equal(
      staffResetTarget.status,
      404,
      "the customer reset action must not target staff accounts",
    );
    assert.equal(sentCustomerResetEmails.length, 0);

    const customerReset = await request(customerResetPath, {
      method: "POST",
      headers: { authorization: `Bearer ${resetAdminToken}` },
    });
    assert.equal(customerReset.status, 200);
    assert.deepEqual(customerReset.body, { ok: true });
    assert.equal(sentCustomerResetEmails.length, 1);
    assert.equal(sentCustomerResetEmails[0].to, `${suspendedCustomerId}@example.test`);
    const completedCustomerReset = await request("/auth/password-reset/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: sentCustomerResetEmails[0].token,
        password: "customer-reset-password-2026!",
      }),
    });
    assert.equal(
      completedCustomerReset.status,
      200,
      "a suspended customer can use the administrator-issued reset link",
    );
    const [suspendedCustomerAfterReset] = await db
      .select({
        status: tradifyUsers.status,
      })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.id, suspendedCustomerId));
    assert.equal(
      suspendedCustomerAfterReset?.status,
      "suspended",
      "password recovery must not reactivate a suspended customer",
    );
    const reusedCustomerReset = await request("/auth/password-reset/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: sentCustomerResetEmails[0].token,
        password: "another-customer-reset-password",
      }),
    });
    assert.equal(reusedCustomerReset.status, 400, "the administrator-issued reset link is one-use");

    const resetAudit = await db
      .select({
        action: tradifyAdminAuditEvents.action,
        targetUserId: tradifyAdminAuditEvents.targetUserId,
      })
      .from(tradifyAdminAuditEvents)
      .where(eq(tradifyAdminAuditEvents.targetUserId, suspendedCustomerId));
    assert.ok(resetAudit.some((entry) => entry.action === "CUSTOMER_PASSWORD_RESET_LINK_SENT"));

    passwordResetEmailProvider.send = async () => {
      throw new PasswordResetEmailDeliveryError(422, "validation_error");
    };
    const failedDelivery = await request(
      `/admin/users/${encodeURIComponent(user.id)}/password-reset`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${resetAdminToken}` },
      },
    );
    assert.equal(failedDelivery.status, 503);
    const revokedFailedDelivery = await db
      .select({
        consumedAt: tradifyPasswordResetTokens.consumedAt,
      })
      .from(tradifyPasswordResetTokens)
      .where(eq(tradifyPasswordResetTokens.userId, user.id));
    assert.ok(revokedFailedDelivery[0]?.consumedAt, "an undelivered reset token must be revoked");
  } finally {
    passwordResetEmailProvider.isConfigured = originalResetIsConfigured;
    passwordResetEmailProvider.send = originalSendResetEmail;
  }

  console.log(
    "Admin route checks passed: authorization, customer password recovery, staff revocation and logout, CRM updates, engine controls, and audit history.",
  );
} finally {
  try {
    await db
      .delete(tradifyStaffAccess)
      .where(eq(tradifyStaffAccess.userId, `${membershipEstimateFixtureIdPrefix}-administrator`));
    await db
      .delete(tradifyStaffAccess)
      .where(eq(tradifyStaffAccess.userId, `${membershipEstimateFixtureIdPrefix}-staff`));
    if (membershipEstimateFixtureIds.length > 0) {
      await db
        .delete(tradifyPasswordResetTokens)
        .where(inArray(tradifyPasswordResetTokens.userId, membershipEstimateFixtureIds));
      await db.delete(tradifyUsers).where(inArray(tradifyUsers.id, membershipEstimateFixtureIds));
    }
    const [routeTestUser] = await db
      .select({ id: tradifyUsers.id })
      .from(tradifyUsers)
      .where(eq(tradifyUsers.email, routeTestEmail))
      .limit(1);
    if (routeTestUser) {
      await db
        .delete(tradifyPasswordResetTokens)
        .where(eq(tradifyPasswordResetTokens.userId, routeTestUser.id));
      await db.delete(tradifyUsers).where(eq(tradifyUsers.id, routeTestUser.id));
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  } finally {
    await pool.end();
  }
}
