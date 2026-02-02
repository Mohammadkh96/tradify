# TRADIFY - Trading Journal Application

## Overview
TRADIFY is a rule-based trading journal application designed to enforce disciplined trading through real-time validation, following a "Stealth Terminal" dark aesthetic. It helps traders record trades, enforce trading rules, analyze performance, and learn trading concepts without AI decision-making, indicators, or guesswork. The application focuses on using predefined Market Knowledge rules for analysis.

Key capabilities include:
- A dashboard with customizable performance metrics and an equity curve.
- A trade journal for chronological trade tracking.
- A "Strategies" section for creating, managing, and validating trading frameworks against predefined rules.
- An "Education Hub" with comprehensive trading lessons, accessible by subscription tier.
- Risk/position size calculators.
- Integration with MetaTrader 5 (MT5) for multi-account trade tracking.
- An interactive onboarding tour for new users.
- Premium features (PRO/ELITE tiers) such as AI Instrument Analysis, Session and Time-Based Performance Analytics, Behavioral Risk Flags, Strategy Deviation Analysis, Monthly Self-Review Reports, and Professional PDF Reports.
- A tiered plan system (Free, Pro, Elite) with feature gating and differentiated trade history retention.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Aesthetic:** "Stealth Terminal" dark theme.
- **Components:** Uses shadcn/ui components with a New York style.
- **Icons:** Lucide React for icons.
- **Visuals:** Elite/Pro badges for subscribers with distinct styling.

### Technical Implementations
- **Frontend:** React 18 with TypeScript, Wouter for routing, TanStack Query for server state, Tailwind CSS for styling, Recharts for data visualization, Framer Motion for animations, and React Hook Form with Zod for forms.
- **Backend:** Express.js with TypeScript, built with Vite for frontend and esbuild for server bundling. API uses REST endpoints defined in `shared/routes.ts`.
- **Data Validation:** Zod schemas are shared between client and server for consistent validation.
- **Rule Engine:** A metadata-driven rule engine (defined in `shared/ruleTypes.ts`) allows for dynamic rule creation and validation. The `RULE_TYPE_CATALOG` centralizes rule types and their metadata for dynamic UI rendering and comparison logic.

### Feature Specifications
- **MT5 Bridge:** Supports multi-account connectivity, independently tracking trades, equity, and analytics for each MT5 account.
- **Plan System:** Centralized configuration in `shared/plans.ts` with feature gating via frontend hooks and backend utilities. Trade history retention is tier-specific.
- **Email System:** Uses Nodemailer with Google Workspace SMTP for various email types, including welcome, admin-created user, password reset, subscription notifications, and contact form handling, with rate limiting.
- **Admin Panel:** Provides user management (creation, plan changes, deactivation, deletion), accessible only by OWNER/ADMIN roles, with audit logging.

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