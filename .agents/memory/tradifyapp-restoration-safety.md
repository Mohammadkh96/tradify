---
name: TradifyApp production restoration safety
description: Preserve TradifyApp production data and keep the separate Tradify Signals service untouched during restoration.
---

Restore only the TradifyApp trading journal without losing customer information. Keep its existing production Neon database as the source of truth; use an isolated, empty development database and never copy production data. Do not modify Tradify Signals, Tradigo, or their code, databases, or deployments. Do not publish to production, change DNS, or make production schema changes without explicit approval.

**Why:** The user explicitly set these boundaries while requesting a safe restoration.

**How to apply:** During TradifyApp restoration and release work, use read-only production checks unless approved otherwise, keep all previews and synthetic tests on the isolated development database, leave Signals and Tradigo untouched, and separate code fixes from production data changes.

Do not create paid manual snapshots or wake production compute without explicit approval. Basic production verification should use only a short `READ ONLY` transaction after asking before waking the idle endpoint.

**Why:** The user wants to preserve the original production database without new subscriptions or unnecessary snapshot costs, and requires approval before compute wake.

**How to apply:** Keep `tradifyapp-dev` for development; preserve the production connection configuration; if production counts need verification, ask before starting compute and run only read-only queries.

Keep recurring business jobs out of the web/API process. The API remains Autoscale; scheduled work belongs in a separate Replit project using a Scheduled deployment. Do not activate jobs, run production migrations, send mail, or publish without explicit approval.

**Why:** Replit uses one deployment type per project, and the user approved preparing the worker architecture while explicitly withholding production activation.

**How to apply:** Keep the API free of job timers; stage worker code and migrations separately, and require the user's approval before creating or enabling the production Scheduled deployment.

For isolated PostgreSQL smoke tests, initialize the temporary data directory with the same major version as the `postgres` binary used to start it. Replit module changes can switch the active binary while an older `/tmp` cluster remains.

**Why:** A local test cluster initialized with PostgreSQL 16 cannot be started by the newly pinned PostgreSQL 17 binary.

**How to apply:** Check `initdb --version` and `postgres --version` before reusing a test data directory; create a fresh temporary cluster when the major versions differ.

Treat Journal-local signal-provider and receiver tables as Journal data, not as records owned by the separate Tradify Signals product. Do not begin cross-product integration until both products' architecture reports are compared and the owners approve a versioned contract.

**Why:** Similar naming does not establish shared data ownership or an existing integration; the user requires report comparison before development.

**How to apply:** Keep Journal and Signals data/API boundaries explicit in future design work. Do not inspect or modify the Signals repository or database while working in this project.

For ecosystem branding, the parent brand is Tradify; Tradify Journal retains its dark/emerald identity; Tradify Signals retains its existing navy/gold/teal identity; no cyan accent is approved; Tradigo remains reserved and unavailable.

**Why:** The user explicitly set this product-brand direction and asked that Signals remain an independent product.

**How to apply:** Keep prototypes in the Journal development workspace, use a launch-pending state for unfinished Signals destinations, and do not change Signals assets, code, or release state.

As of 15 October 2026, the user confirms access to Namecheap DNS only; the hosting service/account behind the current domain IP is unidentified.

**Why:** Domain control does not establish ownership or access to the service currently serving the application.

**How to apply:** Do not claim the old host can be restored or redirect DNS to a guessed provider. Identify the hosting service and get separate approval before any DNS or publishing action.

Keep provider-verified Stripe and PayPal subscription updates active while new checkout is disabled; the user confirmed this policy on 15 October 2026.

**Why:** The user wants existing paid subscription changes to keep reconciling while new purchases remain blocked.

**How to apply:** Do not treat `LIVE_BILLING_ENABLED=false` as a global webhook pause. Only add a separate entitlement-update gate if the user explicitly changes this decision.
