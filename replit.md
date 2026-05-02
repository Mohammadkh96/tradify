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
- **Database Backups:** Daily Neon snapshot pipeline with `pg_dump` to Replit Object Storage.