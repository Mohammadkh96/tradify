# Tradigo Coaching Workspace

This is the Tradigo coaching platform workspace, added alongside the original
Tradify application without replacing its root-level source or configuration.

It contains three Replit artifacts:

- `artifacts/tradigo` — Tradigo Trading Coaching web app
- `artifacts/api-server` — API server
- `artifacts/mockup-sandbox` — component and design preview app

Shared packages and database migrations are in `lib/`. The workspace has its
own `package.json`, `pnpm-workspace.yaml`, and lockfile. Run pnpm commands from
this directory to work with this workspace independently of the original
application at the repository root.
