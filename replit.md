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
- New entry form with real-time rule validation (4 hard-coded global rules)
- Knowledge base with trading education modules
- Risk/position size calculator
- MT5 Bridge for MetaTrader 5 integration

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

### Rule Engine Design
The trade validation system uses a structured rule engine (not AI):
1. Detection Rules - How to recognize market conditions
2. Validation Rules - When conditions are valid
3. Execution Rules - When to allow trades
4. Invalidation Rules - When to reject trades

Four global hard rules enforced:
- GR-02: HTF Bias Alignment
- GR-03: Valid Supply/Demand Zone
- GR-05: Entry Confirmation (OB/FVG or liquidity sweep)
- GR-08: Risk/Reward Ratio minimum

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

### AI Integrations (Optional)
- OpenAI integration via Replit AI Integrations
- Audio/voice chat capabilities
- Image generation
- Located in `server/replit_integrations/` and `client/replit_integrations/`