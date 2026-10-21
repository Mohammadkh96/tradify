import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { JSDOM } from "jsdom";
import type { AdminAccessPolicy } from "@workspace/api-client-react";

const activePolicy: AdminAccessPolicy = {
  rowVersion: 4,
  featureMinimumTiers: {
    signalContext: "Free",
    trustedSetupLevels: "Pro",
    performanceContext: "VIP",
    priceAlerts: "Free",
    fullDepthReview: "VIP",
  },
  marketTiers: {
    XAUUSD: "Pro",
    BTCUSD: "Free",
  },
  watchlistLimits: { Free: 10, Pro: 30, VIP: null },
  estimatedMembershipTierCounts: { Free: 8, Pro: 3, VIP: 2 },
  estimatedWatchlistSizeDistribution: [
    { membershipTier: "Free", savedSymbolCount: 8, customerCount: 2 },
    { membershipTier: "Free", savedSymbolCount: 11, customerCount: 3 },
    { membershipTier: "Free", savedSymbolCount: 15, customerCount: 1 },
    { membershipTier: "Pro", savedSymbolCount: 12, customerCount: 2 },
    { membershipTier: "Pro", savedSymbolCount: 30, customerCount: 3 },
    { membershipTier: "Pro", savedSymbolCount: 33, customerCount: 4 },
    { membershipTier: "VIP", savedSymbolCount: 30, customerCount: 1 },
    { membershipTier: "VIP", savedSymbolCount: 40, customerCount: 5 },
  ],
  starterSymbols: ["XAUUSD"],
  markets: [
    { symbol: "XAUUSD", name: "Gold", requiredTier: "Pro", marketType: "STRATEGY" },
    { symbol: "BTCUSD", name: "Bitcoin", requiredTier: "Free", marketType: "QUOTE_ONLY" },
  ],
};

type ApiCall = { method: string; url: string; body?: Record<string, unknown> };

let dom: JSDOM;
let calls: ApiCall[];
let serverPolicy: AdminAccessPolicy;
let originalFetch: typeof globalThis.fetch;
let root: { unmount: () => void } | undefined;

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function waitFor(assertion: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

async function mountPolicyPage() {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  Object.assign(globalThis, { React });
  const { AccessPolicyPage } = await import("./App");
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await React.act(async () => {
    root!.render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(AccessPolicyPage, {
          capabilities: ["memberships.read", "memberships.manage"],
        }),
      ),
    );
  });
  await React.act(async () => {
    await waitFor(
      () => !!container.querySelector('[data-testid="select-policy-feature-signalContext"]'),
      "The access policy editor did not finish loading.",
    );
  });
  return container;
}

async function changeSelect(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
  assert.ok(setter, "Expected a native select value setter.");
  await act(async () => {
    setter.call(select, value);
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

async function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter, "Expected a native input value setter.");
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}

async function act(callback: () => void | Promise<void>) {
  const React = await import("react");
  await React.act(callback);
}

function changedImpactIds(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-testid^="impact-policy-feature-"]:not([data-testid$="-estimate"]), [data-testid^="impact-policy-market-"]:not([data-testid$="-estimate"])',
    ),
  ).map((element) => element.dataset.testid!);
}

function assertOnlyAccessPolicyRequests() {
  assert.ok(calls.length > 0, "Expected the access policy to be read.");
  assert.ok(
    calls.every(
      ({ method, url }) =>
        url === "/api/admin/access-policy" && (method === "GET" || method === "PUT"),
    ),
    `Expected only shared-policy reads or writes, got: ${JSON.stringify(calls)}`,
  );
}

describe("access policy preview", { concurrency: false }, () => {
  beforeEach(() => {
    dom = new JSDOM("<!doctype html><html><body></body></html>", {
      url: "http://localhost/",
    });
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      HTMLInputElement: dom.window.HTMLInputElement,
      HTMLSelectElement: dom.window.HTMLSelectElement,
      Node: dom.window.Node,
      Event: dom.window.Event,
      MouseEvent: dom.window.MouseEvent,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      MutationObserver: dom.window.MutationObserver,
      IS_REACT_ACT_ENVIRONMENT: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: dom.window.navigator,
    });
    calls = [];
    serverPolicy = structuredClone(activePolicy);
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || "GET").toUpperCase();
      const call: ApiCall = { method, url };
      if (method === "PUT") {
        call.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        const update = call.body;
        serverPolicy = {
          ...serverPolicy,
          rowVersion: serverPolicy.rowVersion + 1,
          featureMinimumTiers:
            update.featureMinimumTiers as AdminAccessPolicy["featureMinimumTiers"],
          marketTiers: update.marketTiers as AdminAccessPolicy["marketTiers"],
          watchlistLimits: update.watchlistLimits as AdminAccessPolicy["watchlistLimits"],
          markets: serverPolicy.markets.map((market) => ({
            ...market,
            requiredTier: (update.marketTiers as AdminAccessPolicy["marketTiers"])[market.symbol],
          })),
        };
      }
      calls.push(call);
      return jsonResponse(serverPolicy);
    }) as typeof globalThis.fetch;
  });

  afterEach(async () => {
    if (root) {
      await act(() => root!.unmount());
      root = undefined;
    }
    globalThis.fetch = originalFetch;
    dom.window.close();
  });

  test("lists only changed feature and market tiers with active and draft values", async () => {
    const container = await mountPolicyPage();
    await changeSelect(
      container.querySelector<HTMLSelectElement>(
        '[data-testid="select-policy-feature-signalContext"]',
      )!,
      "Pro",
    );
    await changeSelect(
      container.querySelector<HTMLSelectElement>('[data-testid="select-policy-market-XAUUSD"]')!,
      "VIP",
    );

    assert.deepEqual(changedImpactIds(container), [
      "impact-policy-feature-signalContext",
      "impact-policy-market-XAUUSD",
    ]);
    assert.equal(
      container
        .querySelector('[data-testid="impact-policy-feature-signalContext"] .policy-impact-tiers')
        ?.getAttribute("aria-label"),
      "Minimum tier changes from Free to Pro",
    );
    assert.equal(
      container
        .querySelector('[data-testid="impact-policy-market-XAUUSD"] .policy-impact-tiers')
        ?.getAttribute("aria-label"),
      "Minimum tier changes from Pro to VIP",
    );
    assert.equal(
      container.querySelector('[data-testid="impact-policy-feature-signalContext-estimate"]')
        ?.textContent,
      "ESTIMATEDMay lose access8 Free customers",
    );
    assert.equal(
      container.querySelector('[data-testid="impact-policy-market-XAUUSD-estimate"]')?.textContent,
      "ESTIMATEDMay lose access3 Pro customers",
    );
    assert.equal(
      container.querySelector(".policy-impact-heading .policy-count")?.textContent,
      "2 access rules changed",
    );
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET"],
    );
  });

  test("estimates the customer tiers that may gain access when a requirement is lowered", async () => {
    const container = await mountPolicyPage();
    await changeSelect(
      container.querySelector<HTMLSelectElement>(
        '[data-testid="select-policy-feature-performanceContext"]',
      )!,
      "Pro",
    );

    assert.equal(
      container.querySelector('[data-testid="impact-policy-feature-performanceContext-estimate"]')
        ?.textContent,
      "ESTIMATEDMay gain access3 Pro customers",
    );
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET"],
    );
  });

  test("updates the preview while editing and removes it after discard", async () => {
    const container = await mountPolicyPage();
    const signalContext = container.querySelector<HTMLSelectElement>(
      '[data-testid="select-policy-feature-signalContext"]',
    )!;
    await changeSelect(signalContext, "Pro");
    assert.equal(
      container
        .querySelector('[data-testid="impact-policy-feature-signalContext"] .policy-impact-tiers')
        ?.getAttribute("aria-label"),
      "Minimum tier changes from Free to Pro",
    );

    await changeSelect(signalContext, "VIP");
    assert.equal(
      container
        .querySelector('[data-testid="impact-policy-feature-signalContext"] .policy-impact-tiers')
        ?.getAttribute("aria-label"),
      "Minimum tier changes from Free to VIP",
    );

    await click(
      container.querySelector<HTMLButtonElement>('[data-testid="button-discard-access-policy"]')!,
    );
    assert.equal(container.querySelector('[data-testid="policy-impact-preview"]'), null);
    assert.equal(signalContext.value, "Free");
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET"],
    );
  });

  test("watchlist-only edits show no feature or market access changes", async () => {
    const container = await mountPolicyPage();
    await changeInput(
      container.querySelector<HTMLInputElement>('[data-testid="input-policy-watchlist-free"]')!,
      "14",
    );

    assert.deepEqual(changedImpactIds(container), []);
    assert.equal(
      container.querySelector(".policy-impact-heading .policy-count")?.textContent,
      "0 access rules changed",
    );
    assert.equal(
      container.querySelector('[data-testid="impact-policy-watchlist-free-estimate"]')?.textContent,
      "ESTIMATEDOver 14 symbols1 Free · 7 Pro · 6 VIP customers",
    );
    assert.ok(container.textContent?.includes("Only watchlist capacity differs in this draft."));
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET"],
    );
  });

  test("estimates saved lists above each changed draft limit by current membership tier", async () => {
    const container = await mountPolicyPage();
    await changeInput(
      container.querySelector<HTMLInputElement>('[data-testid="input-policy-watchlist-free"]')!,
      "12",
    );
    await changeInput(
      container.querySelector<HTMLInputElement>('[data-testid="input-policy-watchlist-pro"]')!,
      "32",
    );

    assert.equal(
      container.querySelector('[data-testid="impact-policy-watchlist-free-estimate"]')?.textContent,
      "ESTIMATEDOver 12 symbols1 Free · 7 Pro · 6 VIP customers",
    );
    assert.equal(
      container.querySelector('[data-testid="impact-policy-watchlist-pro-estimate"]')?.textContent,
      "ESTIMATEDOver 32 symbols0 Free · 4 Pro · 5 VIP customers",
    );
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET"],
    );
  });

  test("removes the preview after a successful shared-policy save only", async () => {
    const container = await mountPolicyPage();
    await changeSelect(
      container.querySelector<HTMLSelectElement>(
        '[data-testid="select-policy-feature-signalContext"]',
      )!,
      "Pro",
    );
    await waitFor(
      () => !!container.querySelector('[data-testid="policy-impact-preview"]'),
      `The draft edit did not create its preview. Select: ${
        container.querySelector<HTMLSelectElement>(
          '[data-testid="select-policy-feature-signalContext"]',
        )?.value
      }; calls: ${JSON.stringify(calls)}; text: ${container.textContent}`,
    );

    await click(
      container.querySelector<HTMLButtonElement>('[data-testid="button-save-access-policy"]')!,
    );
    await waitFor(
      () =>
        !container.querySelector('[data-testid="policy-impact-preview"]') &&
        !!container.querySelector(".policy-inline-success"),
      "The saved policy did not replace the draft and clear its preview.",
    );

    assert.equal(
      container.querySelector(".policy-inline-success")?.textContent,
      "Policy revision 5 is now active.",
    );
    assert.equal(serverPolicy.featureMinimumTiers.signalContext, "Pro");
    assertOnlyAccessPolicyRequests();
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET", "PUT", "GET"],
    );
    assert.deepEqual(calls[1].body, {
      rowVersion: 4,
      featureMinimumTiers: { ...activePolicy.featureMinimumTiers, signalContext: "Pro" },
      marketTiers: activePolicy.marketTiers,
      watchlistLimits: { Free: 10, Pro: 30, VIP: null },
    });
  });
});
