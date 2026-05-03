// Lightweight Stripe subscription checkout for TradifyApp.
//
// Why no stripe-replit-sync? We already have our own user/subscription model
// (user_role.subscription_tier + stripe_customer_id + stripe_subscription_id)
// driven historically by PayPal. Adding the full sync schema would duplicate
// state. Instead this module:
//   - resolves price IDs by Stripe lookup_key (tradify_<tier>_<period>)
//   - creates a Checkout Session with metadata identifying the tier/period
//   - handles checkout.session.completed + customer.subscription.deleted via
//     a single webhook to grant/revoke the tier on user_role
//
// User flow mirrors PayPal: button → redirect to Stripe → return to /checkout
// with ?subscription=success&processor=stripe.

import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { pool } from "./db";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripeSecretKey } from "./stripeClient";
import { emailService } from "./emailService";

type Tier = "PRO" | "ELITE" | "COACH";
type Period = "monthly" | "annual";

const TIER_PRICES: Record<Tier, Record<Period, number>> = {
  PRO: { monthly: 2900, annual: 29000 },
  ELITE: { monthly: 5900, annual: 59000 },
  COACH: { monthly: 9900, annual: 99000 },
};

function lookupKey(tier: Tier, period: Period) {
  return `tradify_${tier.toLowerCase()}_${period}`;
}

// Find the price for a tier/period via lookup_key. Idempotent.
//
// IMPORTANT: this NEVER auto-creates products/prices in Stripe. The seed
// script (scripts/seed-stripe-products.ts) is the single owner of product
// creation — that prevents (a) race-on-create when two users subscribe at
// once and (b) accidental creation of duplicate products with similar names
// in case of a Stripe org with manually-entered SKUs. Operators run the
// seed script once per environment.
async function ensurePriceId(stripe: Stripe, tier: Tier, period: Period): Promise<string> {
  const lk = lookupKey(tier, period);
  const existing = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;
  throw new Error(
    `Stripe price not found for ${lk}. Run "npx tsx scripts/seed-stripe-products.ts" to seed products and prices.`,
  );
}

async function setUserTier(userId: string, tier: Tier | "FREE", stripeCustomerId?: string | null, stripeSubscriptionId?: string | null) {
  const fields: string[] = ["subscription_tier = $1", "subscription_status = $2"];
  const values: any[] = [tier, tier === "FREE" ? "canceled" : "active"];
  if (stripeCustomerId !== undefined) { fields.push(`stripe_customer_id = $${values.length + 1}`); values.push(stripeCustomerId); }
  if (stripeSubscriptionId !== undefined) { fields.push(`stripe_subscription_id = $${values.length + 1}`); values.push(stripeSubscriptionId); }
  values.push(userId);
  await pool.query(`UPDATE user_role SET ${fields.join(", ")} WHERE user_id = $${values.length}`, values);
}

export function registerStripeWebhook(app: Express) {
  // CRITICAL: this route MUST be registered BEFORE express.json() middleware
  // so that req.body is the raw Buffer needed for Stripe signature verification.
  // server/index.ts mounts json globally, so we use express.raw() at the route
  // level which Express respects per-route.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) {
      // Without a verified webhook secret, refuse — never trust unsigned events.
      return res.status(400).json({ error: "Missing signature or webhook secret not configured" });
    }
    let event: Stripe.Event;
    try {
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
    } catch (err: any) {
      console.error("[Stripe] webhook signature failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.tradify_user_id;
        const tier = session.metadata?.tradify_tier as Tier | undefined;
        if (userId && tier && (session.mode === "subscription") && session.subscription) {
          await setUserTier(
            userId,
            tier,
            typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
            typeof session.subscription === "string" ? session.subscription : session.subscription.id,
          );
          // Notify user — user_id is the email in this app
          try {
            const u = await storage.getUserRole(userId);
            const email = userId.includes("@") ? userId : null;
            if (email) await emailService.sendSubscriptionActivatedEmail(email, u?.fullName || email.split("@")[0] || "Trader", tier);
          } catch (e) { console.error("[Stripe] activation email error:", e); }
        }
      } else if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object as Stripe.Subscription;
        // Downgrade to FREE only if (a) this is still the user's CURRENT
        // Stripe subscription and (b) they haven't switched to a PayPal sub
        // in the meantime. Otherwise we would yank a paying PayPal user back
        // to FREE just because their old Stripe sub finally got cleaned up.
        const r = await pool.query<{ user_id: string; full_name: string | null; subscription_tier: string | null; paypal_subscription_id: string | null; subscription_provider: string | null }>(
          `SELECT user_id, full_name, subscription_tier, paypal_subscription_id, subscription_provider
           FROM user_role
           WHERE stripe_subscription_id = $1 LIMIT 1`,
          [sub.id],
        );
        const row = r.rows[0];
        if (row && !row.paypal_subscription_id && (row.subscription_provider === "stripe" || row.subscription_provider == null)) {
          await setUserTier(row.user_id, "FREE", undefined, null);
          try {
            const email = row.user_id.includes("@") ? row.user_id : null;
            if (email) await emailService.sendSubscriptionCanceledEmail(email, row.full_name || email.split("@")[0] || "Trader", row.subscription_tier || "PRO");
          } catch (e) { console.error("[Stripe] cancel email error:", e); }
        } else if (row) {
          console.log(`[Stripe] sub.deleted ${sub.id} for ${row.user_id} ignored — user has alternate provider`);
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe] webhook handler error:", err);
      res.status(500).json({ error: "Webhook handler error" });
    }
  });
}

export function registerStripeRoutes(app: Express, requireAuth: any) {
  // POST /api/stripe/subscribe — body { tier, period } → returns { url }
  // Frontend redirects to Stripe Checkout. On success Stripe webhook flips
  // the tier; the user is redirected back to /checkout?subscription=success.
  app.post("/api/stripe/subscribe", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { tier: tierRaw = "PRO", period: periodRaw = "monthly" } = req.body || {};
      const upper = String(tierRaw).toUpperCase();
      const tier: Tier = upper === "COACH" ? "COACH" : upper === "ELITE" ? "ELITE" : "PRO";
      const period: Period = periodRaw === "annual" ? "annual" : "monthly";

      const user = await storage.getUserRole(userId);
      // In TradifyApp the user's login id is their email. Legacy seed accounts
      // (e.g. "dev-user", UUIDs) cannot subscribe via Stripe — they need an
      // email-based account first. Same convention as paypalService.
      const userEmail = userId.includes("@") ? userId : null;
      if (!userEmail) return res.status(400).json({ error: "Account does not have an email on file. Please contact support to upgrade your account before subscribing." });

      const stripe = await getUncachableStripeClient();
      const priceId = await ensurePriceId(stripe, tier, period);

      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: user?.stripeCustomerId ? undefined : userEmail,
        customer: user?.stripeCustomerId || undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/checkout?subscription=success&processor=stripe&tier=${tier}&period=${period}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout?subscription=cancelled&processor=stripe`,
        metadata: { tradify_user_id: userId, tradify_tier: tier, tradify_period: period },
        subscription_data: {
          metadata: { tradify_user_id: userId, tradify_tier: tier, tradify_period: period },
        },
        allow_promotion_codes: true,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("[Stripe] subscribe error:", err);
      res.status(500).json({ error: err.message || "Failed to create checkout session" });
    }
  });

  // Belt-and-suspenders: if a user lands on the success URL before the webhook
  // has fired, this verifies the session and grants tier immediately. Idempotent.
  app.post("/api/stripe/subscription/activate", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { sessionId } = req.body || {};
      if (!sessionId) return res.status(400).json({ error: "sessionId required" });

      const stripe = await getUncachableStripeClient();
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      if (!s) return res.status(404).json({ error: "Session not found" });
      if (s.metadata?.tradify_user_id !== userId) return res.status(403).json({ error: "Session does not belong to this user" });
      if (s.payment_status !== "paid" && s.status !== "complete") {
        return res.status(400).json({ error: "Checkout not completed" });
      }
      const tier = (s.metadata?.tradify_tier || "PRO") as Tier;
      await setUserTier(
        userId,
        tier,
        typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
        typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null,
      );
      res.json({ success: true, tier });
    } catch (err: any) {
      console.error("[Stripe] activate error:", err);
      res.status(500).json({ error: err.message || "Activation failed" });
    }
  });

  // Open the Stripe customer portal for self-service management/cancellation.
  app.post("/api/stripe/portal", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserRole(userId);
      if (!user?.stripeCustomerId) return res.status(400).json({ error: "No Stripe customer on file" });
      const stripe = await getUncachableStripeClient();
      const protocol = req.get("x-forwarded-proto") || req.protocol;
      const host = req.get("host");
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${protocol}://${host}/profile`,
      });
      res.json({ url: portal.url });
    } catch (err: any) {
      console.error("[Stripe] portal error:", err);
      res.status(500).json({ error: err.message || "Portal session failed" });
    }
  });

  // Public — exposes the publishable key to the frontend.
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
