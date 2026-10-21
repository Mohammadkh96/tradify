import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchAdminRevenueCatPriceSummary,
  type RevenueCatCatalogProxy,
} from "./revenuecat-catalog";

test("reads only the current RevenueCat offering and reports indicative prices safely", async () => {
  const requests: Array<{ service: string; path: string; method: string | undefined }> = [];
  const apps = {
    items: [
      {
        id: "ios-app",
        name: "Signals iOS",
        type: "app_store",
        app_store: { app_store_connect_api_key_configured: true },
      },
      {
        id: "android-app",
        name: "Signals Android",
        type: "play_store",
        play_store: { play_service_account_credentials_configured: false },
      },
    ],
  };
  const offerings = {
    items: [
      {
        id: "archived-offering",
        display_name: "Archived",
        lookup_key: "archived",
        is_current: false,
        packages: { items: [] },
      },
      {
        id: "current-offering",
        display_name: "Tradify Memberships",
        lookup_key: "default",
        is_current: true,
        packages: {
          items: [
            {
              id: "pro-monthly",
              display_name: "Pro Monthly",
              products: {
                items: [
                  {
                    product: {
                      id: "pro-ios",
                      app_id: "ios-app",
                      display_name: "Tradify Pro Monthly",
                      state: "active",
                      store_identifier: "tradify_pro_monthly",
                      indicative_price: {
                        amount_micros: "4990000",
                        currency: "USD",
                        country: "US",
                      },
                    },
                  },
                  {
                    product: {
                      id: "pro-android",
                      app_id: "android-app",
                      display_name: "Tradify Pro Monthly",
                      state: "active",
                      store_identifier: "tradify_pro_monthly:monthly",
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  };
  const proxy: RevenueCatCatalogProxy = {
    async proxy(service, path, options) {
      requests.push({ service, path, method: options?.method });
      return new Response(JSON.stringify(path.includes("/apps?") ? apps : offerings), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  };

  const summary = await fetchAdminRevenueCatPriceSummary(
    proxy,
    "project-test",
    new Date("2026-10-06T12:00:00.000Z"),
  );

  assert.equal(summary.fetchedAt, "2026-10-06T12:00:00.000Z");
  assert.deepEqual(summary.currentOffering, {
    id: "current-offering",
    displayName: "Tradify Memberships",
    lookupKey: "default",
  });
  assert.equal(summary.products.length, 2);
  assert.deepEqual(summary.products[0]?.indicativePrice, {
    amountMicros: "4990000",
    currency: "USD",
    country: "US",
  });
  assert.equal(summary.products[0]?.priceUnavailableReason, null);
  assert.equal(summary.products[1]?.indicativePrice, null);
  assert.equal(summary.products[1]?.priceUnavailableReason, "STORE_CREDENTIALS_MISSING");
  assert.deepEqual(
    requests.map((request) => request.method),
    ["GET", "GET"],
  );
  assert.ok(requests.every((request) => request.service === "revenuecat"));
});

test("fails explicitly when the RevenueCat catalog cannot be read", async () => {
  const proxy: RevenueCatCatalogProxy = {
    async proxy() {
      return new Response(JSON.stringify({ message: "unavailable" }), { status: 429 });
    },
  };

  await assert.rejects(fetchAdminRevenueCatPriceSummary(proxy, "project-test"), /status 429/);
});
