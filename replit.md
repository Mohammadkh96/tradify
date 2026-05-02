# TRADIFY - Trading Discipline Platform

## Overview
TRADIFY is a discipline enforcement platform for serious traders, built with a dark "Stealth" aesthetic. It enforces trading rules through real-time validation and behavioral analysis, targeting prop firm traders. The platform aims to be "Your Rules. Enforced." with the tagline "Discipline is the edge."

Key capabilities include:
- Customizable dashboard with performance metrics and equity curve.
- Trade journal and strategy validation.
- Gamified "Education Hub" with progressive lessons and an optional AI Tutor.
- Risk and position size calculators.
- Multi-account trade tracking integrated with MetaTrader 5 (MT5).
- Interactive onboarding tour and sample data activation for new users.
- Premium features like AI Instrument Analysis, Behavioral Risk Flags, Strategy Deviation Analysis, and Monthly Self-Review Reports.
- Real-time Risk Alerts: server-side alert engine evaluated after every MT5 sync with notifications table, email templates, in-app notification center (bell icon in MainLayout header), Alert Settings card on Profile, dedupe + per-alert cooldowns, and admin observability widget (`/api/admin/alert-volume`).
- Tiered subscription model (Free, Pro, Elite) with feature gating.
- Prop Firm Challenge Tracker with AI Risk Analysis for Elite users.
- Lead magnets including a Pre-Trade Checklist and Prop Firm Challenge Calculator with UTM attribution tracking.
- Database Backups admin (`/admin/backups`): daily Neon snapshots to object storage, weekly restore-verification, and a One-Click Restore panel — admins can download any backup (`GET /api/admin/backups/:id/download`, fail-closed audit-logged as `BACKUP_DOWNLOAD` in `admin_audit_log`) and follow copy-paste psql commands to restore into a scratch database.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Aesthetic:** Dark "Stealth" theme.
- **Components:** shadcn/ui with New York style.
- **Icons:** Lucide React.
- **Visuals:** Distinct Elite/Pro badges for subscribers.

### Technical Implementations
- **Frontend:** React 18, TypeScript, react-router-dom, TanStack Query, Tailwind CSS, Recharts, Framer Motion, React Hook Form with Zod.
- **Backend:** Express.js with TypeScript, built with Vite (frontend) and esbuild (server). REST API.
- **Data Validation:** Zod schemas shared between client and server.
- **Rule Engine:** Metadata-driven rule engine for dynamic rule creation and validation.

### Feature Specifications
- **MT5 Bridge:** Supports multi-account connectivity and aggregates trade history.
- **Plan System:** Centralized configuration for feature gating and tier-specific data retention.
- **Email System:** Nodemailer with Google Workspace SMTP, managing 6 lifecycle tracks for leads and users (lead nurture, activation, ongoing engagement, retention, and insights newsletters). Includes a one-click unsubscribe system.
- **Email Verification:** Mandatory for new users.
- **Admin Panel:** User management with audit logging for OWNER/ADMIN roles.
- **Cookie Consent System:** GDPR-compliant banner with customizable preferences.
- **Psychology & Mood Tracking:** Inline mood and mistake category selectors on trade cards.
- **CSV Trade Import:** Supports bulk import from various platforms.
- **Dashboard Customization:** Users can toggle widget visibility.
- **AI Psychology Review:** Pro+ dashboard widget for psychology-aware insights using OpenAI.
- **AI Marketing Hub:** Admin-only command center with Content Studio (Quick Create & Funnel Builder), Meta Ads Strategist, Brand Settings, Library & Calendar, Smart Suggestions, and Content Pipeline.
- **Achievements & Badges System:** Gamification with XP, leveling, streaks, and achievements across various categories.
- **MT5 Connector (Professional GUI):** Enhanced Python connector script with tkinter GUI for improved user experience. Sandbox e2e regression test in `scripts/test-mt5-bridge.ts` (run with `tsx scripts/test-mt5-bridge.ts`) and a manual QA checklist in `docs/MT5_BRIDGE_QA.md` cover the full /mt5-bridge wizard flow.
- **Blog System:** Full CMS for content marketing with CRUD, public listing, categories, and SEO.
- **SEO System:** Enhanced SEO with Open Graph, Twitter Cards, structured data, dynamic `robots.txt` and `sitemap.xml`, and targeted landing pages.
- **About Page:** Provides founder story, mission, product philosophy, and trust signals.
- **Testimonials:** Social proof section on the landing page.
- **Referral System:** Auto-generated referral codes, tracking, and referral stats.

### System Design Choices
- **Project Structure:** Clear separation of client, server, and shared code.
- **Database:** PostgreSQL with Drizzle ORM.
- **Core Tables:** `strategies`, `strategy_rules`, and `trade_journal`.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM.
- **UI Libraries:** shadcn/ui, Tailwind CSS, Lucide React.
- **MT5 Integration:** Custom Expert Advisor (EA) via HTTP POST.
- **Payment Gateway:** PayPal for recurring subscriptions and webhooks.
- **AI Integrations:** OpenAI for AI Instrument Analysis, Monthly Self-Review Reports, AI Tutor, and AI Marketing.
- **AI Cost Intelligence:** Admin-only dashboard for monitoring AI usage costs.
- **Database Backups:** Daily Neon snapshot pipeline with `pg_dump` to Replit Object Storage. `pg_dump` major version is pinned to the Neon server major via `.replit` modules (`postgresql-17`); a startup self-check refuses to arm the scheduler if no compatible binary is on PATH (`server/backup-service.ts#ensurePgDumpAvailable`). A separate weekly verifier (Sundays 04:30 UTC) downloads the latest backup, gunzips it, and validates the structural markers + required tables, persisting the result onto `database_backups.restore_verified_*` columns and surfacing pass/fail badges in `/admin/backups`. Failed verification triggers `sendBackupVerificationFailureAlertEmail`.
- **Alert Engine Tests:** Pure helpers in `server/alertEngine.ts` (DD math, revenge cluster detection, overtrading classification, strategy deviation, dedupe predicate) are covered by `server/alertEngine.test.ts`. Run with `npx vitest run --config vitest.config.ts`.
- **i18n (6 languages: en/es/fr/de/zh/ar with RTL):** i18next with a single `common` namespace nested into sub-namespaces (marketing, app pages, legal, publicPages, footer, seo, kb, ...). Translation tooling: `node scripts/i18n-translate-namespace.mjs <ns>` (chunked, parallel langs, retry, skip-translated) + `node scripts/_merge_keys.mjs <ns> <keys.json>`. Pass 1 (marketing), Pass 2 (15 app pages), and Pass 3 (legal, publicPages, SEO landing pages, KnowledgeBase UI chrome) are wired across all 6 languages. Lesson content from `client/src/data/educationLessons.ts` is intentionally left in English (data file). Admin pages (AdminDashboard + admin/* — ~10K lines, admin-only audience) are deferred to a separate task.
## Coach Tier (#11) — 2026-05-02
- New tier: $99/mo / $990/yr, max 25 students, includes everything in Elite.
- Schema: `coach_student` (status: invited/active/declined/removed) + `coach_feedback` (per-trade or general). Migrations in `server/db.ts`.
- Backend: `requireCoach` middleware + endpoints under `/api/coach/*` (students CRUD, invite by email, read student trades, post feedback) and `/api/student/coach` + `/api/student/coach-invite/:id/respond`. Active-link auth checks on all reads/writes.
- PayPal: `PAYPAL_COACH_PLAN_ID` + `PAYPAL_COACH_ANNUAL_PLAN_ID` env vars; `createSubscription` accepts COACH; checkout flow upgrades PRO/ELITE→COACH.
- Frontend: 4-col Pricing grid w/ violet Coach card; `/coach` CoachDashboard (invite form, student grid, drawer w/ Trades/Feedback/Manage tabs); `MyCoachBanner` on Dashboard for invites + recent feedback; conditional Coach nav link.
- Admin: `TIER_PRICE` includes COACH:$99; tier change emails route COACH→elite_retention sequence.
