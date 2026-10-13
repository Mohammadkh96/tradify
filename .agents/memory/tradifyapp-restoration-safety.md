---
name: TradifyApp production restoration safety
description: Preserve TradifyApp production data and keep the separate Tradify Signals service untouched during restoration.
---

Restore TradifyApp without losing customer information. Do not change `signals.tradifyapp.com`. Do not publish to production, change Namecheap DNS, or make potentially destructive production schema changes without explicit approval.

**Why:** The user explicitly set these boundaries while requesting a safe restoration.

**How to apply:** During TradifyApp restoration and release work, use read-only production checks unless approved otherwise, leave the Signals service and DNS alone, and separate code fixes from production data changes.
