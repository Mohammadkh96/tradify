# Tradify Signals PWA subscription proposal

**Status:** Proposal only. No provider selected, billing integration activated, plan changed, or production system modified.
**Scope:** Web purchases for the existing Signals PWA only. Native iOS/Android RevenueCat purchases remain unchanged.

## Current state

- Signals has Free, Pro, and VIP memberships. Their access rules are owned by the Signals API.
- Native purchases use RevenueCat packages `pro_monthly` and `vip_monthly`; prices are read from the active store offering rather than hardcoded in the app.
- The Expo app disables purchases on web. RevenueCat's current Signals configuration therefore does not sell PWA memberships.
- The API is already the membership authority and processes RevenueCat events for native billing.
- This proposal does not change plan benefits, prices, existing customer memberships, or store billing.

## Web-payment options

| Option | Fit for Signals PWA | Advantages | Tradeoffs |
| --- | --- | --- | --- |
| **Stripe Checkout + Billing** | Strongest fit if Signals should own its web checkout and subscription lifecycle | Hosted checkout; signed subscription webhooks; customer portal for payment-method and cancellation management; flexible mapping into the existing Signals entitlement authority | Requires merchant configuration and backend work; Signals must own account linking, entitlement reconciliation, customer support paths, and applicable tax/compliance decisions |
| **Whop hosted checkout + memberships** | Viable if a hosted membership storefront and Whop's commerce lifecycle are preferred | Hosted checkout; membership lifecycle APIs; signed webhooks for payment and membership events | Adds a separate commerce/membership authority and customer workflow that must be reconciled to Signals accounts and entitlements; less direct control over a first-party Signals billing experience |
| **RevenueCat** | Keep for current native purchases; not proposed for plain PWA purchases | Preserves existing iOS/Android setup | The current project explicitly disables the RevenueCat purchase path on web; this proposal does not enable it or change the current provider boundary |

**Provisional recommendation:** If PWA purchases are approved later, evaluate Stripe Checkout and Billing first, with the Signals API remaining the sole authority for product access. This is a technical fit recommendation, not provider activation or a pricing decision. Whop remains a reasonable alternative if hosted membership operations are more important than keeping the full billing lifecycle close to Signals.

## Required design before implementation

1. Keep Free, Pro, and VIP unchanged. Map only existing paid tiers; do not create a bundle or new entitlement.
2. Use an authenticated Signals account ID as the provider-customer mapping key. Do not merge accounts by matching email addresses.
3. Create hosted checkout sessions server-side; never trust a browser return URL as proof of payment.
4. Verify webhook signatures, persist event IDs, make processing idempotent, and tolerate retries and out-of-order delivery.
5. Define subscription states, grace periods, refunds, chargebacks, cancellations, renewal failures, account deletion, and support ownership before granting or removing access.
6. Keep entitlement checks server-authoritative. A provider dashboard status or client SDK result must not independently unlock Signals features.
7. Define how web and Apple/Google subscriptions interact for the same Signals account, including duplicate-subscription detection and customer-facing instructions. Do not silently transfer or cancel a store subscription.
8. Confirm supported merchant country, currencies, taxes, consumer disclosures, refund obligations, and data-retention requirements before choosing a provider or enabling checkout.
9. Test webhook replay, duplicate events, delayed events, provider outages, payment failures, account switching, and plan expiry against a disposable non-production database.
10. Obtain explicit approval before creating provider products, connecting a payment integration, adding secrets, changing API/schema behavior, or enabling live checkout.

## Ecosystem boundaries

- A web purchase would grant a **Signals** membership only. It would not grant Journal access or create shared identity.
- Journal billing remains separate. No combined subscription, shared checkout, or cross-product entitlement endpoint is proposed.
- Signals Admin, strategy evaluation, MT5 bridge, notifications, production data, DNS, and deployment are out of scope.
- Task 381 remains paused/cancelled in its existing documented state; this proposal does not resume it.

## References

- Stripe Billing and subscriptions: https://docs.stripe.com/billing
- Stripe subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe customer portal: https://docs.stripe.com/customer-management
- Whop webhooks: https://docs.whop.com/developer/guides/webhooks
- Whop memberships: https://docs.whop.com/developer/guides/memberships
