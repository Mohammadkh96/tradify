---
name: TradifyApp production restoration safety
description: Preserve TradifyApp production data and keep the separate Tradify Signals service untouched during restoration.
---

Restore TradifyApp without losing customer information. Do not change `signals.tradifyapp.com`. Do not publish to production, change Namecheap DNS, or make potentially destructive production schema changes without explicit approval.

**Why:** The user explicitly set these boundaries while requesting a safe restoration.

**How to apply:** During TradifyApp restoration and release work, use read-only production checks unless approved otherwise, leave the Signals service and DNS alone, and separate code fixes from production data changes.

Keep recurring business jobs out of the web/API process. The API remains Autoscale; scheduled work belongs in a separate Replit project using a Scheduled deployment. Do not activate jobs, run production migrations, send mail, or publish without explicit approval.

**Why:** Replit uses one deployment type per project, and the user approved preparing the worker architecture while explicitly withholding production activation.

**How to apply:** Keep the API free of job timers; stage worker code and migrations separately, and require the user's approval before creating or enabling the production Scheduled deployment.

For isolated PostgreSQL smoke tests, initialize the temporary data directory with the same major version as the `postgres` binary used to start it. Replit module changes can switch the active binary while an older `/tmp` cluster remains.

**Why:** A local test cluster initialized with PostgreSQL 16 cannot be started by the newly pinned PostgreSQL 17 binary.

**How to apply:** Check `initdb --version` and `postgres --version` before reusing a test data directory; create a fresh temporary cluster when the major versions differ.
