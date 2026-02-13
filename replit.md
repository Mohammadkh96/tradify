# TRADIFY - Trading Journal Application

## Overview
TRADIFY is a rule-based trading journal application designed to enforce disciplined trading through real-time validation, following a "Stealth Terminal" dark aesthetic. It helps traders record trades, enforce trading rules, analyze performance, and learn trading concepts without AI decision-making, indicators, or guesswork. The application focuses on using predefined Market Knowledge rules for analysis.

Key capabilities include:
- A dashboard with customizable performance metrics and an equity curve.
- A trade journal for chronological trade tracking.
- A "Strategies" section for creating, managing, and validating trading frameworks against predefined rules.
- An "Education Hub" with 19 progressive lessons organized into 8 phases (0-7) using a gamified progression system. Phase 0 (Orientation) is mandatory. Phases 0-1 are FREE, Phases 2-5 require PRO, Phases 6-7 require ELITE. Lessons are unlocked sequentially by completing the previous lesson AND passing its quiz with 70%+ score. Phase structure: Orientation → Market Foundations → Liquidity & Intent → Smart Money Tools → Execution & Confirmation → Risk & Trade Management → Psychology & Discipline → System Building. Data in `client/src/data/educationLessons.ts` with `EDUCATION_PHASES` and `EDUCATION_LESSONS` arrays. Access control uses `AccessTier` type ("FREE"|"PRO"|"ELITE") and `isLessonUnlocked()` helper. AI Tutor available for Pro/Elite users. Trading knowledge context injected into AI prompts via `server/tradingKnowledge.ts`.
- Risk/position size calculators.
- Integration with MetaTrader 5 (MT5) for multi-account trade tracking.
- An interactive onboarding tour for new users (tracked via `hasSeenTour` database field; tour shows only on first login).
- Premium features (PRO/ELITE tiers) such as AI Instrument Analysis, Session and Time-Based Performance Analytics, Behavioral Risk Flags, Strategy Deviation Analysis, Monthly Self-Review Reports, and Professional PDF Reports.
- A tiered plan system (Free, Pro, Elite) with feature gating and differentiated trade history retention.
- **Founding Member Program:** Early access signup at `/early-access` with exclusive benefits (1 month free Pro automatically granted on registration, lifetime 30% discount, feature influence, exclusive badge). Founding members display amber-styled Crown badge in navigation, dashboard, and profile. Tracked via `foundingMember` field on users and `early_access_signups` table for pre-launch signups. Auto-Pro managed via `foundingMemberProExpiry` timestamp — `/api/user` checks expiry on each request and downgrades to FREE if expired and no active PayPal/Stripe subscription.
- **Prop Firm Challenge Tracker:** Full prop firm challenge management at `/prop-firm` (Pro+Elite). Tracks FTMO, MyFundedFX, The Funded Trader presets plus custom configs. Features: circular SVG gauges for profit target/drawdown, daily stats logging, trailing drawdown with HWM tracking, consistency scoring, days remaining countdown. AI Risk Analysis panel (Elite) lets users check proposed trade parameters against challenge rules before entry — calculates potential loss, daily/max DD impact, and suggests tighter SL. `PropFirmRiskBanner` on Strategy Validator alerts users with active challenges. DB tables: `prop_firm_challenges`, `prop_firm_daily_stats`. API: `/api/prop-firm/*` routes including `POST /api/prop-firm/ai-risk-check`.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Aesthetic:** "Stealth Terminal" dark theme.
- **Components:** Uses shadcn/ui components with a New York style.
- **Icons:** Lucide React for icons.
- **Visuals:** Elite/Pro badges for subscribers with distinct styling.

### Technical Implementations
- **Frontend:** React 18 with TypeScript, react-router-dom for routing, TanStack Query for server state, Tailwind CSS for styling, Recharts for data visualization, Framer Motion for animations, and React Hook Form with Zod for forms.
- **Backend:** Express.js with TypeScript, built with Vite for frontend and esbuild for server bundling. API uses REST endpoints defined in `shared/routes.ts`.
- **Data Validation:** Zod schemas are shared between client and server for consistent validation.
- **Rule Engine:** A metadata-driven rule engine (defined in `shared/ruleTypes.ts`) allows for dynamic rule creation and validation. The `RULE_TYPE_CATALOG` centralizes rule types and their metadata for dynamic UI rendering and comparison logic.

### Feature Specifications
- **MT5 Bridge:** Supports multi-account connectivity, independently tracking trades, equity, and analytics for each MT5 account.
- **Plan System:** Centralized configuration in `shared/plans.ts` with feature gating via frontend hooks and backend utilities. Trade history retention is tier-specific.
- **Email System:** Uses Nodemailer with Google Workspace SMTP for various email types, including welcome, admin-created user, password reset, email verification, subscription notifications, and contact form handling, with rate limiting.
- **Email Verification:** New users must verify their email before logging in. Verification tokens expire after 24 hours. Admin/Owner accounts bypass verification. Users can resend verification emails from the verification screen.
- **Admin Panel:** Provides user management (creation, plan changes, deactivation, deletion, founding member status toggle), accessible only by OWNER/ADMIN roles, with audit logging.
- **Cookie Consent System:** GDPR-compliant cookie banner with Accept All/Reject All/Customize options. Users can manage preferences for Analytics (Google Analytics) and Marketing (Facebook Pixel) cookies via modal. Preferences stored in localStorage. Cookie Policy page at `/cookie-policy`. Footer includes Cookie Policy link and Cookie Settings button. Tracking hooks in `client/src/hooks/useTracking.ts` gate analytics/marketing scripts based on consent.

### System Design Choices
- **Project Structure:** Clearly separates client, server, and shared code.
- **Database:** PostgreSQL with Drizzle ORM for database interactions and schema management. `drizzle-kit push` for migrations.
- **Core Tables:** `strategies`, `strategy_rules`, and `trade_journal` store essential application data.

## External Dependencies

- **Database:** PostgreSQL (configured via `DATABASE_URL`), Drizzle ORM, `connect-pg-simple` for session storage.
- **UI Libraries:** shadcn/ui (Radix UI primitives), Tailwind CSS, Lucide React.
- **MT5 Integration:** Custom Expert Advisor (EA) communicates with the backend via HTTP POST to `/api/mt5/update`.
- **Payment Gateway:** PayPal for recurring subscriptions exclusively, handling 3-tier pricing (Free, Pro, Elite). Integrates with PayPal's webhook system for subscription status management.
- **AI Integrations (Optional):** OpenAI integration via Replit AI Integrations for features like AI Instrument Analysis and Monthly Self-Review Reports.