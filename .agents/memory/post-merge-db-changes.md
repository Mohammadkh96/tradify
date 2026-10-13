---
name: Post-merge database changes
description: Keep automatic merge setup non-interactive and safe around database schema changes.
---

Keep post-merge setup non-interactive and non-destructive. Do not run `drizzle-kit push` automatically when it can prompt to infer table renames; do not use `--force` to suppress that prompt.

**Why:** A post-merge run paused on an ambiguous `session` → `alert_preferences` rename prompt, and Drizzle's force option can approve data-loss operations.

**How to apply:** Use reviewed, explicit migrations for schema changes. Keep routine post-merge setup to dependency installation and build steps unless a database migration has been intentionally reviewed.
