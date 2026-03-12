# TRADIFY - Trading Discipline Platform

## Overview
TRADIFY is a discipline enforcement platform for serious traders, built with a dark "Stealth" aesthetic. It enforces trading rules through real-time validation and behavioral analysis. The landing page positioning is "Your Rules. Enforced." with the tagline "Discipline is the edge." All messaging is problem-led (leads with trader pain, not features) and targets prop firm traders as the primary audience.

Key features include:
- A customizable dashboard with performance metrics and an equity curve.
- A trade journal for chronological tracking.
- A "Strategies" section for creating and validating trading frameworks.
- An "Education Hub" offering 19 progressive lessons across 8 phases with a gamified progression system and an optional AI Tutor for premium users.
- Risk and position size calculators.
- Multi-account trade tracking integration with MetaTrader 5 (MT5).
- An interactive onboarding tour for new users.
- Premium features (PRO/ELITE tiers) like AI Instrument Analysis, Session/Time-Based Performance Analytics, Behavioral Risk Flags, Strategy Deviation Analysis, Monthly Self-Review Reports, and Professional PDF Reports.
- A tiered subscription model (Free, Pro, Elite) with feature gating and differentiated data retention.
- A Founding Member Program offering early access benefits and exclusive discounts.
- A Prop Firm Challenge Tracker for managing and analyzing performance against proprietary trading firm rules, including an AI Risk Analysis panel for Elite users.
- Landing page lead magnets: Pre-Trade Checklist (email capture → printable checklist at /checklist) and Prop Firm Challenge Calculator (interactive tool with email save). Leads stored in `leads` table with `email`, `source`, `metadata`.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Aesthetic:** Dark "Stealth" theme.
- **Components:** Uses shadcn/ui components with a New York style.
- **Icons:** Lucide React.
- **Visuals:** Distinct Elite/Pro badges for subscribers.

### Technical Implementations
- **Frontend:** React 18, TypeScript, react-router-dom, TanStack Query, Tailwind CSS, Recharts, Framer Motion, React Hook Form with Zod.
- **Backend:** Express.js with TypeScript, built with Vite (frontend) and esbuild (server). REST API defined in `shared/routes.ts`.
- **Data Validation:** Zod schemas shared between client and server for consistency.
- **Rule Engine:** A metadata-driven rule engine (defined in `shared/ruleTypes.ts`) supports dynamic rule creation and validation, centralizing rule types and metadata in `RULE_TYPE_CATALOG`.

### Feature Specifications
- **MT5 Bridge:** Supports multi-account connectivity, aggregating trade history across all accounts for analytics endpoints.
- **Plan System:** Centralized configuration in `shared/plans.ts` with feature gating and tier-specific trade history retention.
- **Email System:** Nodemailer with Google Workspace SMTP for various notifications and account management, including rate limiting.
- **Email Verification:** Mandatory for new users (except Admin/Owner) with a 24-hour token expiry and resend options.
- **Admin Panel:** User management (creation, plan changes, deactivation, deletion, founding member status) with audit logging, accessible only by OWNER/ADMIN roles.
- **Cookie Consent System:** GDPR-compliant banner with customizable preferences for Analytics (Google Analytics) and Marketing (Facebook Pixel), stored in localStorage.
- **Psychology & Mood Tracking:** Inline mood and mistake category selectors on trade cards, updating `trade_journal` and `mt5_history` tables.
- **CSV Trade Import:** Supports importing trades from MT4/MT5, TradingView, or custom CSVs via client-side parsing (PapaParse) and bulk API import.
- **Dashboard Customization:** Users can toggle widget visibility, saved to a `dashboard_config` JSONB column on the `user_role` table.
- **AI Psychology Review:** A Pro+ dashboard widget that aggregates mood/mistake data and uses OpenAI for psychology-aware insights, with a 6-hour cache.
- **AI Marketing Hub:** Admin-only command center with unified Content Studio (Quick Create + Funnel Builder tabs), Meta Ads Strategist, Brand Settings, Library & Calendar, and Marketing Dashboard with Smart Suggestions and Content Pipeline. Sidebar: flat 5-item list (Dashboard, Content Studio, Library & Calendar, Meta Ads, Brand Settings). Campaigns page removed from frontend (backend routes preserved).
- **Content Studio (Unified):** Merged Content Studio + Content Factory into single page (`client/src/pages/admin/ContentStudio.tsx`) with two mode buttons: **Quick Create** (Posts, Reel Scripts, Blog Articles, Email Campaigns sub-tabs) and **Funnel Builder** (AIDA funnel engine from `FunnelGenerator.tsx`). Funnel Builder generates ad images (gpt-image-1), video reels (MP4 via ffmpeg), stock photos, social posts, reel scripts, ad copy, blog articles, email campaigns, landing pages (HTML), comparison posts, testimonial posts, and case studies. Routes: `/api/admin/marketing/funnel/*`.
- **Library & Calendar:** Content Library (`ContentLibrary.tsx`) with calendar as default view (Mon-start week), "Fill My Week" AI auto-scheduling (generates 7 pieces Mon-Sun via `/api/admin/marketing/content/fill-week`), one-click content repurposing dialog (`/api/admin/marketing/content/:id/repurpose`), scheduled date display, and performance rating. Schema additions: `scheduledDate` (timestamp), `repurposedFrom` (integer) on `marketingContent`.
- **Smart Suggestions:** Dashboard panel analyzing top-rated content (rating >= 4) via AI to generate 3 personalized content ideas with hooks and reasoning (`/api/admin/marketing/smart-suggestions`).
- **Content Pipeline:** Dashboard panel with configurable weekly content generation schedule (type, count, platform per row). Config saved to `contentPipeline` jsonb field in `marketingBrandSettings` (`PATCH /api/admin/marketing/pipeline`). Manual "Run Pipeline Now" trigger (`POST /api/admin/marketing/pipeline/run`) generates configured content and auto-schedules across the week as drafts.
- **Achievements & Badges System:** Gamification layer with 25 achievements across 5 categories (Milestones, Discipline, Streaks, Education, Performance). Features: XP/leveling system (10 levels from Beginner to Immortal), journal/trading/compliance streaks with flame indicators in sidebar, auto-checking on dashboard load. Schema: `user_achievements` and `user_streaks` tables. Backend: `server/achievements.ts` with `checkAchievements()` engine. Routes: `GET /api/achievements`, `GET /api/achievements/streaks`, `POST /api/achievements/check`. Dashboard widget with level, XP, streaks, and recent unlocks. Dedicated `/achievements` page with full badge grid, progress bars, tier badges (bronze/silver/gold/platinum).
- **MT5 Connector (Professional GUI):** Enhanced Python connector script with tkinter GUI (no CMD black screen). Features: Tradify-branded window, live connection status, account info panel, scrollable sync log with color-coded entries, start/stop button, auto-reconnect. MT5 Bridge page redesigned with modern 3-step setup flow, branded download button, live status display, and troubleshooting section.
- **Blog System:** A full CMS for content marketing with CRUD operations, public listing, category filtering, and SEO optimization (Open Graph, JSON-LD).
- **SEO System:** Enhanced SEO component with Open Graph, Twitter Cards, structured data (JSON-LD), server-side `robots.txt`, and a dynamic `sitemap.xml`. SEO landing pages at `/trading-journal`, `/prop-firm-tracker`, `/mt5-trading-analytics` targeting high-intent keywords. Organization structured data in `index.html`, BreadcrumbList support in SEO component, HowTo on How It Works, Product on Pricing. Comprehensive internal linking footer on landing page.
- **About Page:** `/about` page with founder story, mission statement, product philosophy, trust signals, and Person structured data for E-E-A-T.
- **Testimonials:** Social proof section on landing page with trader testimonials.
- **Referral System:** Auto-generated referral codes on signup (`referralCode` column), `referredBy` tracking, `?ref=CODE` capture on registration, referral stats endpoint (`/api/user/referral-stats`), referral card in Profile page with shareable link and referral count.

### System Design Choices
- **Project Structure:** Clear separation of client, server, and shared code.
- **Database:** PostgreSQL with Drizzle ORM for interactions and schema management.
- **Core Tables:** `strategies`, `strategy_rules`, and `trade_journal`.

## External Dependencies

- **Database:** PostgreSQL, Drizzle ORM, `connect-pg-simple`.
- **UI Libraries:** shadcn/ui, Tailwind CSS, Lucide React.
- **MT5 Integration:** Custom Expert Advisor (EA) communicating via HTTP POST.
- **Payment Gateway:** PayPal for recurring subscriptions across three tiers (Free, Pro, Elite) with monthly/annual options and founding member discounts, integrating with PayPal webhooks.
- **AI Integrations:** OpenAI for features like AI Instrument Analysis, Monthly Self-Review Reports, AI Tutor, and AI Marketing.
- **AI Cost Intelligence:** Admin-only dashboard (`/admin/costs`) with global filter bar (period presets, custom date range, tier/feature/model dropdowns), cost overview cards, tier/feature/model breakdowns, daily trend chart, top users table with search and drill-down dialog (per-user cost profile with feature/model breakdown, daily trend, and recent logs), full paginated usage log viewer with sortable columns and CSV export, manual fixed costs CRUD with Replit cost presets (Reserved VM, Deployment, Agent, Neon DB), and budget alert settings with progress visualization. Backend: 14 admin API endpoints under `/api/admin/costs/*` with date range and user filtering, paginated log search, and per-user cost profiles. DB tables: `ai_usage_logs`, `manual_costs`, `cost_budget_alerts`.