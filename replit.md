# TRADIFY - Trading Journal Application

## Overview

TRADIFY is a rule-based trading journal application designed to enforce disciplined trading through real-time validation. The app follows a "Stealth Terminal" dark aesthetic and helps traders record trades, enforce trading rules, analyze performance, and learn trading concepts.

**Core Principle:** No AI decision making, no indicators, no guessing. All analysis uses predefined Market Knowledge rules that evaluate conditions like a trading engine.

Key features:
- Dashboard with performance metrics (win rate, profit factor, R:R ratios)
  - Date filtering (All Time, Today, Week, Month, Custom date range)
  - Trade Statistics panel (avg win/loss, best/worst trade, win/loss/breakeven counts)
  - Performance Intelligence panel (profit factor, total trades, expectancy)
  - Equity curve shows cumulative P&L filtered by selected date range
- Trade journal with chronological trade feed
- **Strategies section** (formerly "New Entry")
  - My Strategies: View, edit, duplicate, and delete trading frameworks
  - Create Strategy: Define rules from RULE_TYPE_CATALOG
  - Strategy Validator: Check trade alignment against selected strategy's rules
- Knowledge base with trading education modules
- Risk/position size calculator (5 calculators in 3 category tabs)
- MT5 Bridge for MetaTrader 5 integration
- **Onboarding Tour**: Interactive step-by-step guide for new users
  - Auto-launches for first-time users (localStorage tracking)
  - 8-step walkthrough of main features (Dashboard, Strategies, Calculator, MT5, Education, Traders Hub, Profile)
  - Keyboard navigation support (arrows, Escape)
  - Restart button in sidebar footer
- **AI Instrument Analysis** (PRO only): Analyze trading performance on specific instruments
  - Select instrument from MT5 history dropdown
  - Shows stats: trade count, win rate, avg P&L, total P&L
  - AI-generated factual performance analysis (no trade recommendations)
  - 30-minute cache to limit API calls
  - Server-side PRO subscription enforcement
- **Session Performance Analytics** (ELITE only): Trade performance by market session
  - Classifies trades into sessions based on UTC entry time:
    - Asian: 00:00 - 07:00 UTC
    - London: 07:00 - 12:00 UTC
    - London/NY Overlap: 12:00 - 16:00 UTC
    - New York: 16:00 - 21:00 UTC
    - Off Hours: 21:00 - 00:00 UTC
  - Shows per-session: win rate, P&L, trade count, avg P&L
  - Visual bar charts comparing P&L and win rate across sessions
  - Highlights best and worst performing sessions
  - Server-side Elite tier enforcement via `/api/session-analytics/:userId`
- **Time-Based Performance Analysis** (ELITE only): Performance by day and hour
  - Day of week analysis: P&L and win rate per weekday (Mon-Sun)
  - Hour of day analysis: 24-hour heatmap showing trade activity and performance (UTC)
  - Metrics per time period: trade count, wins/losses, P&L, avg P&L, win rate
  - Visual bar charts for day performance, heatmap grid for hourly patterns
  - Highlights best/worst trading days and hours
  - Server-side Elite tier enforcement via `/api/time-patterns/:userId`
- **Behavioral Risk Flags** (ELITE only): Automated pattern detection for trading behavior
  - Revenge trading detection: Identifies increased position sizes on the next trade after consecutive losses (MT5 only)
  - Session overtrading: Flags abnormally high trade frequency in specific sessions
  - Risk creep: Detects gradual position size increases over time (MT5 only)
  - Rapid retry: Identifies quick re-entry after losing trades (<15 min)
  - Loss chasing: Flags increased volume on losing days (MT5 only)
  - Historical comparison: 30-day vs prior 30-day volume/frequency changes
  - Volume-based flags require MT5 trades (manual trades excluded due to missing lot size)
  - All flags include severity (high/medium/low), title, description, and data-backed evidence
  - Pattern observations only, no trading advice language
  - Server-side Elite tier enforcement via `/api/behavioral-risks/:userId`
- **Strategy Deviation Analysis** (ELITE only): Measure how often users break strategy rules
  - Compare performance: compliant trades vs non-compliant trades
  - Metrics: win rate, P&L, average P&L for each group
  - Most violated rules: ranked list with violation count and affected trades
  - Rule performance impact: shows avg P&L when rule is followed vs violated
  - Strategy breakdown: compliance rate per strategy with P&L comparison
  - Uses data from Strategy Validator evaluations (tradeComplianceResults, tradeRuleEvaluations)
  - No market judgment, purely factual performance comparison
  - Server-side Elite tier enforcement via `/api/strategy-deviation/:userId`
- **Monthly Self-Review Report** (ELITE only): AI-generated monthly performance reviews
  - Reflective tone using first-person observations ("I noticed...", "My trading showed...")
  - Contents: What improved, what needs attention, key behavioral observations, best-performing conditions
  - Month selector to view historical reports
  - Metrics comparison with previous month (trades, win rate, P&L, profit factor)
  - Integrates behavioral flags, session data, and compliance data for context
  - Exportable as markdown file
  - Cached in aiPerformanceInsights table with "monthly-review-YYYY-MM" timeframe pattern
  - Server-side Elite tier enforcement via `/api/monthly-review/:userId`
  - Available months endpoint: `/api/monthly-review/:userId/available`

**Plan System:**
- Centralized plan configuration in `shared/plans.ts`
- Three tiers: Free, Pro ($19/mo), Elite ($39/mo)
- Feature gating via `usePlan()` hook on frontend, plan utilities on backend
- **Trade History Retention by Tier:**
  - Free: Last 30 days of trade history
  - Pro: Last 6 months (180 days) of trade history
  - Elite: Unlimited trade history (no date cutoff)
  - Filtering applied server-side via `filterByTierDate()` helper function
  - Affects: equity curve, performance metrics, trade journal, instrument stats
  - No data is deleted - older trades are simply hidden from view
- Key features per tier:
  - Free: 1 strategy, 30-day history, basic analytics
  - Pro: Unlimited strategies, 6-month history, AI analysis, CSV export
  - Elite: Unlimited history, session analytics, time patterns, PDF reports

**Admin Panel** (`/admin/users`):
- Manual user creation with email and plan tier (FREE/PRO/ELITE)
- Auto-generates temporary password shown to admin after creation
- Plan tier can be changed anytime via dropdown
- User deactivation/reactivation and deletion
- Audit logging of all admin actions
- Access restricted to OWNER/ADMIN roles

**Navigation Structure:**
- Collapsible "Strategies" menu in sidebar with sub-items
- Routes: `/strategies` (My Strategies), `/strategies/create` (Create Strategy), `/strategies/validate` (Strategy Validator)
- Auto-expands when navigating to strategies routes

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight router)
- **State Management:** TanStack Query for server state
- **Styling:** Tailwind CSS with shadcn/ui components (New York style)
- **Charts:** Recharts for data visualization
- **Animations:** Framer Motion for transitions
- **Forms:** React Hook Form with Zod validation

### Backend Architecture
- **Framework:** Express.js with TypeScript
- **Build Tool:** Vite for frontend, esbuild for server bundling
- **API Pattern:** REST endpoints defined in `shared/routes.ts`
- **Validation:** Zod schemas shared between client and server

### Data Storage
- **Database:** PostgreSQL with Drizzle ORM
- **Schema Location:** `shared/schema.ts`
- **Migrations:** Drizzle Kit (`drizzle-kit push`)
- **Key Tables:**
  - `strategies` - User-defined trading frameworks (userId, name, description, isActive)
  - `strategy_rules` - Dynamic rules per strategy (category, ruleType, options JSONB)
  - `trade_journal` - Trade records with compliance tracking

### Rule Engine Design
The validation system uses a metadata-driven rule engine defined in `shared/ruleTypes.ts`:
- **RULE_TYPE_CATALOG**: Central catalog of all available rule types with metadata
- **Metadata fields**: displayPrefix, displaySuffix, inputPlaceholder, numberComparator
- **Input types**: boolean, number, select, multiselect, time_range
- **Categories**: detection, validation, execution, invalidation

Strategy Validator uses metadata to:
- Dynamically render inputs based on rule type
- Display helper text and labels without hardcoded rule-specific logic
- Compare user inputs against strategy values using metadata-defined comparators

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components
    pages/        # Route pages
    hooks/        # Custom React hooks
    lib/          # Utilities
server/           # Express backend
  routes.ts       # API endpoints
  storage.ts      # Database operations
  db.ts           # Database connection
shared/           # Shared code
  schema.ts       # Drizzle schema + Zod types
  routes.ts       # API route definitions
```

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL` environment variable)
- Drizzle ORM for queries and schema management
- connect-pg-simple for session storage

### UI Components
- shadcn/ui component library (Radix UI primitives)
- Tailwind CSS for styling
- Lucide React for icons

### MT5 Integration
- Custom Expert Advisor (EA) sends data via HTTP POST
- Server endpoint at `/api/mt5/update` receives account/position data
- Polling from client every 2 seconds for live updates
- Note: MT5 WebRequest has SSL/certificate limitations

### PayPal Subscriptions
- **Exclusive payment provider** - PayPal recurring subscriptions only (no Stripe)
- **3-Tier pricing**: Free (1 strategy), Pro ($19/month), Elite ($39/month)
- **Plan ID persistence** - Uses `PAYPAL_PRO_PLAN_ID` and `PAYPAL_ELITE_PLAN_ID` env vars
- **Tier detection** - Server determines tier from PayPal plan_id (source of truth)
- **Webhook verification** - Uses `PAYPAL_WEBHOOK_ID` for signature verification
- **Smart cancellation** - Users retain access until billing period ends
- **Subscription flow**:
  1. User clicks subscribe button → tier stored in sessionStorage
  2. User redirected to PayPal approval
  3. On return, client calls `/api/paypal/subscription/activate` with subscription_id and tier hint
  4. Server fetches subscription from PayPal, determines tier from plan_id, updates user
  5. Webhooks handle ongoing status updates (activated, cancelled, expired)
- **Profile management** - Users can view subscription details and cancel from Profile page
- **Feature gates** - All components check for PRO or ELITE tier using case-insensitive comparison

### AI Integrations (Optional)
- OpenAI integration via Replit AI Integrations
- Audio/voice chat capabilities
- Image generation
- Located in `server/replit_integrations/` and `client/replit_integrations/`