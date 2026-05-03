// Seed (or re-seed) Stripe products and prices for TradifyApp.
//
// Usage:   npx tsx scripts/seed-stripe-products.ts
//
// Idempotent — re-running will reuse existing products/prices identified by
// product name and price lookup_key. Run this once after the Stripe connector
// is authorized, or whenever you change pricing.

import { getUncachableStripeClient } from "../server/stripeClient";

type Tier = "PRO" | "ELITE" | "COACH";
type Period = "monthly" | "annual";

const TIERS: Record<Tier, { monthly: number; annual: number; description: string }> = {
  PRO: { monthly: 2900, annual: 29000, description: "Pro tier — full strategy validation, history, AI analysis" },
  ELITE: { monthly: 5900, annual: 59000, description: "Elite tier — Pro features + prop firm tracker, monthly AI review, full education" },
  COACH: { monthly: 9900, annual: 99000, description: "Coach tier — Elite features + manage up to 25 students with feedback" },
};

async function main() {
  const stripe = await getUncachableStripeClient();
  for (const [tierKey, cfg] of Object.entries(TIERS) as [Tier, { monthly: number; annual: number; description: string }][]) {
    const productName = `TradifyApp ${tierKey}`;
    let productId: string;
    const ps = await stripe.products.search({ query: `active:'true' AND name:'${productName}'`, limit: 1 });
    if (ps.data.length > 0) {
      productId = ps.data[0].id;
      console.log(`✓ product exists: ${productName} (${productId})`);
    } else {
      const p = await stripe.products.create({
        name: productName,
        description: cfg.description,
        metadata: { tradify_tier: tierKey },
      });
      productId = p.id;
      console.log(`+ created product: ${productName} (${productId})`);
    }

    for (const period of ["monthly", "annual"] as Period[]) {
      const lk = `tradify_${tierKey.toLowerCase()}_${period}`;
      const existing = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 });
      if (existing.data.length > 0) {
        console.log(`  ✓ price exists: ${lk} (${existing.data[0].id})`);
        continue;
      }
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: cfg[period],
        currency: "usd",
        recurring: { interval: period === "annual" ? "year" : "month" },
        lookup_key: lk,
        metadata: { tradify_tier: tierKey, tradify_period: period },
      });
      console.log(`  + created price: ${lk} = $${cfg[period] / 100} (${price.id})`);
    }
  }
  console.log("\nDone. Add STRIPE_WEBHOOK_SECRET to env after creating the webhook in Stripe Dashboard pointed at /api/stripe/webhook.");
}

main().catch((e) => { console.error(e); process.exit(1); });
