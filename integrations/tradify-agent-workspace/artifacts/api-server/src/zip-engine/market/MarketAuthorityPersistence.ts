import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  tradifyMarketAuthorityDecisions,
  tradifyMarketAuthorityTransitions,
  tradifyMarketProviders,
} from "@workspace/db/schema";
import type { AuthorityDecision, ProviderRegistration } from "./ProviderRegistry";
import type { MarketDataContext } from "./types";
import {
  buildPersistedAuthorityEvidence,
  sanitizeDiagnosticText,
} from "./ProviderDiagnosticSanitizer";

export async function loadPersistedAuthority(contextKey: string): Promise<string | null> {
  const [row] = await db
    .select({ providerId: tradifyMarketAuthorityDecisions.providerId })
    .from(tradifyMarketAuthorityDecisions)
    .where(eq(tradifyMarketAuthorityDecisions.contextKey, contextKey))
    .limit(1);
  return row?.providerId ?? null;
}

export async function persistProviderRegistration(
  registration: ProviderRegistration,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(tradifyMarketProviders)
    .values({
      id: registration.id,
      displayName: registration.displayName,
      role: registration.role,
      approval: registration.approval,
      priority: registration.priority,
      enabled: registration.enabled,
      capabilities: {
        providerName: registration.provider.name,
      },
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: tradifyMarketProviders.id,
      set: {
        displayName: registration.displayName,
        role: registration.role,
        approval: registration.approval,
        priority: registration.priority,
        enabled: registration.enabled,
        capabilities: {
          providerName: registration.provider.name,
        },
        updatedAt: now,
      },
    });
}

export async function persistAuthorityTransition(
  context: MarketDataContext,
  previousProviderId: string | null,
  decision: AuthorityDecision,
): Promise<void> {
  const now = new Date().toISOString();
  const contextKey = decision.contextKey;
  const evidence = buildPersistedAuthorityEvidence(decision);
  const reason = sanitizeDiagnosticText(decision.reason);
  await db.transaction(async (tx) => {
    await tx.insert(tradifyMarketAuthorityTransitions).values({
      id: crypto.randomUUID(),
      contextKey,
      canonicalSymbol: context.canonicalSymbol,
      timeframe: context.timeframe,
      strategyId: context.strategyId,
      previousProviderId,
      nextProviderId: decision.selectedProviderId,
      reason,
      healthEvidence: evidence,
      createdAt: now,
    });
    await tx
      .insert(tradifyMarketAuthorityDecisions)
      .values({
        contextKey,
        canonicalSymbol: context.canonicalSymbol,
        timeframe: context.timeframe,
        strategyId: context.strategyId,
        providerId: decision.selectedProviderId,
        reason,
        evidence,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: tradifyMarketAuthorityDecisions.contextKey,
        set: {
          providerId: decision.selectedProviderId,
          reason,
          evidence,
          updatedAt: now,
        },
      });
  });
}

export async function listRecentAuthorityTransitions(limit = 100) {
  return db
    .select()
    .from(tradifyMarketAuthorityTransitions)
    .orderBy(desc(tradifyMarketAuthorityTransitions.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
