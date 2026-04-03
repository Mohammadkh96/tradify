const COLORS = {
  darkBg: "#0A0F1E",
  emerald: "#00D9A3",
  white: "#FFFFFF",
  lightGray: "#C8C8D2",
  midGray: "#8C8CA0",
  darkCard: "#121929",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  darkHeader: "#0F1426",
};

function Page({ children, pageNum }: { children: React.ReactNode; pageNum: number }) {
  return (
    <div
      style={{
        width: 816,
        minHeight: 1056,
        background: COLORS.darkBg,
        color: COLORS.lightGray,
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "48px",
        position: "relative",
        marginBottom: 32,
        boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ borderBottom: `1px solid ${COLORS.emerald}`, paddingBottom: 8, marginBottom: 24, display: "flex", justifyContent: "space-between", fontSize: 9, color: COLORS.midGray }}>
        <span>TRADIFY COMPETITIVE ANALYSIS — CONFIDENTIAL</span>
        <span>April 2026</span>
      </div>
      {children}
      <div style={{ position: "absolute", bottom: 24, left: 48, right: 48, borderTop: `1px solid ${COLORS.midGray}40`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 9, color: COLORS.midGray }}>
        <span>tradifyapp.com</span>
        <span>Page {pageNum} of 7</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.emerald, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{children}</h2>
      <div style={{ width: 120, height: 2, background: COLORS.emerald, marginTop: 6 }} />
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, lineHeight: 1.6 }}>
      <span style={{ color: COLORS.emerald, flexShrink: 0 }}>▸</span>
      <span>{children}</span>
    </div>
  );
}

function Table({ headers, rows, colWidths }: { headers: string[]; rows: string[][]; colWidths?: string[] }) {
  const widths = colWidths || headers.map(() => `${100 / headers.length}%`);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 16 }}>
      <thead>
        <tr style={{ background: COLORS.darkHeader }}>
          {headers.map((h, i) => (
            <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: COLORS.emerald, fontWeight: 600, textTransform: "uppercase", fontSize: 9, letterSpacing: 0.5, width: widths[i] }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 0 ? "#0C1120" : "transparent" }}>
            {row.map((cell, ci) => (
              <td key={ci} style={{ padding: "6px 10px", color: cell === "✓" ? COLORS.green : cell === "✗" ? COLORS.red : cell === "~" ? COLORS.amber : COLORS.lightGray }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CompetitiveAnalysis() {
  return (
    <div style={{ background: "#050810", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* PAGE 1 — EXECUTIVE SUMMARY */}
      <Page pageNum={1}>
        <div style={{ marginTop: 60 }}>
          <div style={{ fontSize: 12, color: COLORS.emerald, letterSpacing: 3, fontWeight: 600, textTransform: "uppercase" }}>COMPETITIVE ANALYSIS</div>
          <h1 style={{ fontSize: 42, fontWeight: 700, color: COLORS.white, margin: "24px 0 8px" }}>TRADIFY</h1>
          <div style={{ fontSize: 16, color: COLORS.lightGray }}>Trading Discipline Platform</div>
          <div style={{ fontSize: 12, color: COLORS.emerald, marginTop: 4 }}>Your Rules. Enforced.</div>
          <div style={{ width: 80, height: 2, background: COLORS.emerald, margin: "24px 0" }} />
          <div style={{ fontSize: 11, color: COLORS.midGray }}>April 2026 | Confidential | v1.0</div>
        </div>

        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 14, color: COLORS.emerald, fontWeight: 600, marginBottom: 14 }}>POSITIONING STATEMENT</h3>
          <p style={{ fontSize: 12, lineHeight: 1.8, color: COLORS.lightGray }}>
            For retail and prop firm traders who consistently break their own rules and blow accounts, Tradify is a trading discipline platform that enforces your trading rules in real-time through MT5 integration, behavioral analysis, and AI-powered insights. Unlike TraderSync, Edgewonk, and TradeZella — which log trades after the fact — Tradify prevents bad trades before they happen.
          </p>
        </div>

        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 14, color: COLORS.emerald, fontWeight: 600, marginBottom: 14 }}>TOP 3 STRATEGIC RECOMMENDATIONS</h3>
          <Bullet><strong style={{ color: COLORS.white }}>1. OWN THE "DISCIPLINE ENFORCEMENT" CATEGORY</strong> — No major competitor enforces rules in real-time. TraderSync and Edgewonk track violations after the fact. Position Tradify as the only journal that actually prevents bad trades.</Bullet>
          <Bullet><strong style={{ color: COLORS.white }}>2. DOUBLE DOWN ON PROP FIRM TRADERS</strong> — TradeZella charges $29-49/mo for basic prop firm tracking. Tradify's integrated Challenge Tracker with AI Risk Analysis is a stronger value prop. Target the 500K+ active challenge participants.</Bullet>
          <Bullet><strong style={{ color: COLORS.white }}>3. LEVERAGE THE FOUNDING MEMBER MOAT</strong> — At 16/500 founding members with lifetime 30% discounts, create urgency. Competitors have no equivalent loyalty program.</Bullet>
        </div>
      </Page>

      {/* PAGE 2 — COMPETITIVE LANDSCAPE */}
      <Page pageNum={2}>
        <SectionTitle>Competitive Landscape</SectionTitle>
        <p style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
          The trading journal market has 7 significant players. Most compete on analytics depth and broker integrations. None have built real-time rule enforcement — creating a clear category gap for Tradify.
        </p>
        <Table
          headers={["Competitor", "Est.", "Pricing", "Users", "Top Strength", "Key Weakness"]}
          rows={[
            ["TraderSync", "2013", "$30-80/mo", "N/A", "AI coaching (Cypher)", "No free tier, expensive"],
            ["Edgewonk", "2014", "$169/yr", "N/A", "Psychology tracking", "No AI, no replay"],
            ["TradeZella", "2021", "$29-49/mo", "N/A", "Trade replay", "No free trial, no refunds"],
            ["TradesViz", "2019", "$0-30/mo", "100K+", "Free tier (3K trades)", "Overwhelming UX"],
            ["Tradervue", "2011", "$0-50/mo", "207K+", "Community/mentorship", "Aging platform"],
            ["TradeControl", "2024", "Freemium", "New", "Circuit breaker lockout", "Very early stage"],
            ["Trademetria", "2016", "$0-30/mo", "80K+", "Gamified challenges", "Limited AI features"],
          ]}
          colWidths={["14%", "6%", "12%", "8%", "30%", "30%"]}
        />

        <h3 style={{ fontSize: 13, color: COLORS.emerald, fontWeight: 600, marginTop: 16, marginBottom: 12 }}>FUNDING & MARKET CONTEXT</h3>
        <Bullet>Most competitors are bootstrapped or lightly funded. No VC-backed market leader has emerged.</Bullet>
        <Bullet>TraderSync is the most mature AI player ($30-80/mo) but has no free tier — creating an opening.</Bullet>
        <Bullet>TradeControl is the only competitor attempting discipline enforcement, but it's browser-only with local storage — no cloud sync, no MT5 integration, very early stage.</Bullet>
        <Bullet>The prop firm industry (FTMO, TopStep, Funded Next) has 500K+ active challenge participants. No journal specifically targets this segment with integrated challenge tracking.</Bullet>
      </Page>

      {/* PAGE 3 — FEATURE MATRIX */}
      <Page pageNum={3}>
        <SectionTitle>Feature Comparison Matrix</SectionTitle>
        <p style={{ fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>Features weighted by buyer importance. <span style={{ color: COLORS.green }}>Green = available</span>, <span style={{ color: COLORS.red }}>Red = missing</span>, <span style={{ color: COLORS.amber }}>Amber = partial</span>.</p>
        <Table
          headers={["Feature (by weight)", "Tradify", "TraderSync", "Edgewonk", "TradeZella", "TradesViz", "Tradervue"]}
          rows={[
            ["Rule Enforcement (real-time)", "✓", "✗", "✗", "✗", "✗", "✗"],
            ["Strategy Builder + Validation", "✓", "~", "~", "~", "✗", "✗"],
            ["MT5 Live Integration", "✓", "~", "~", "✗", "~", "~"],
            ["Prop Firm Challenge Tracker", "✓", "✗", "~", "~", "✗", "✗"],
            ["AI Trading Insights", "✓", "✓", "✗", "✗", "✓", "✗"],
            ["AI Psychology Review", "✓", "~", "✓", "✗", "✗", "✗"],
            ["Trade Journal", "✓", "✓", "✓", "✓", "✓", "✓"],
            ["Equity Curve Analytics", "✓", "✓", "✓", "✓", "✓", "✓"],
            ["Mood/Psychology Tracking", "✓", "~", "✓", "✗", "✗", "✗"],
            ["Education System", "✓", "✗", "✗", "✗", "✗", "✗"],
            ["Achievement/Gamification", "✓", "✗", "✗", "✗", "✗", "✗"],
            ["Trade Replay", "✗", "✓", "✗", "✓", "✓", "✗"],
            ["900+ Broker Imports", "✗", "✓", "~", "✗", "~", "~"],
            ["Mobile App", "✗", "✓", "✗", "✗", "✗", "~"],
            ["Community Features", "✗", "✗", "✗", "~", "✗", "✓"],
            ["Free Tier", "✓", "✗", "✗", "✗", "✓", "~"],
          ]}
          colWidths={["24%", "11%", "13%", "13%", "13%", "13%", "13%"]}
        />
        <div style={{ padding: "10px 14px", background: `${COLORS.emerald}15`, borderLeft: `3px solid ${COLORS.emerald}`, fontSize: 10, color: COLORS.emerald, lineHeight: 1.6, marginTop: 8 }}>
          KEY INSIGHT: Tradify wins on 10 of 16 features. The 3 gaps (trade replay, massive broker imports, mobile app) are future roadmap items. No competitor offers the combination of rule enforcement + prop firm tracking + AI insights + free tier.
        </div>
      </Page>

      {/* PAGE 4 — PRICING & POSITIONING MAP */}
      <Page pageNum={4}>
        <SectionTitle>Pricing Comparison & Positioning Map</SectionTitle>
        <p style={{ fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
          Tradify's tiered pricing (Free / Pro / Elite) is competitive. The Founding Member program (30% lifetime discount) creates urgency no competitor matches.
        </p>
        <Table
          headers={["Platform", "Free Tier", "Entry Paid", "Mid Tier", "Top Tier", "Annual Discount"]}
          rows={[
            ["TRADIFY", "Yes (full)", "$9.99/mo Pro", "—", "$19.99/mo Elite", "Founding: 30% off"],
            ["TraderSync", "No", "$29.95/mo", "$49.95/mo", "$79.95/mo", "~35% annual"],
            ["Edgewonk", "No", "$169/yr flat", "—", "—", "N/A (one tier)"],
            ["TradeZella", "No", "$29/mo", "—", "$49/mo", "17-32% annual"],
            ["TradesViz", "Yes (stocks)", "$19.99/mo", "—", "$29.99/mo", "25% annual"],
            ["Tradervue", "30 trades", "$29.95/mo", "—", "$49.95/mo", "10-20% annual"],
            ["Trademetria", "30 trades", "$19.95/mo", "—", "$29.95/mo", "~16% annual"],
          ]}
          colWidths={["14%", "12%", "16%", "14%", "18%", "26%"]}
        />

        <h3 style={{ fontSize: 13, color: COLORS.emerald, fontWeight: 600, marginTop: 24, marginBottom: 16 }}>POSITIONING MAP (2x2)</h3>
        <div style={{ position: "relative", width: 600, height: 360, margin: "0 auto 24px" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: COLORS.midGray + "40" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: COLORS.midGray + "40" }} />

          <div style={{ position: "absolute", left: "50%", top: -20, transform: "translateX(-50%)", fontSize: 9, color: COLORS.midGray, textTransform: "uppercase" }}>Expensive</div>
          <div style={{ position: "absolute", left: "50%", bottom: -20, transform: "translateX(-50%)", fontSize: 9, color: COLORS.midGray, textTransform: "uppercase" }}>Affordable</div>
          <div style={{ position: "absolute", left: -10, top: "50%", transform: "translateY(-50%) rotate(-90deg)", fontSize: 9, color: COLORS.midGray, textTransform: "uppercase", whiteSpace: "nowrap" }}>Passive Logging</div>
          <div style={{ position: "absolute", right: -20, top: "50%", transform: "translateY(-50%) rotate(90deg)", fontSize: 9, color: COLORS.midGray, textTransform: "uppercase", whiteSpace: "nowrap" }}>Active Enforcement</div>

          {[
            { name: "TRADIFY", x: "82%", y: "30%", color: COLORS.emerald, size: 12, bold: true },
            { name: "TraderSync", x: "45%", y: "15%", color: COLORS.blue, size: 8, bold: false },
            { name: "Edgewonk", x: "35%", y: "60%", color: COLORS.amber, size: 8, bold: false },
            { name: "TradeZella", x: "42%", y: "22%", color: COLORS.red, size: 8, bold: false },
            { name: "TradesViz", x: "30%", y: "72%", color: COLORS.lightGray, size: 8, bold: false },
            { name: "Tradervue", x: "25%", y: "28%", color: COLORS.lightGray, size: 8, bold: false },
            { name: "TradeControl", x: "72%", y: "80%", color: COLORS.midGray, size: 7, bold: false },
            { name: "Trademetria", x: "38%", y: "62%", color: COLORS.lightGray, size: 7, bold: false },
          ].map((c) => (
            <div key={c.name} style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%, -50%)" }}>
              <div style={{ width: c.bold ? 14 : 8, height: c.bold ? 14 : 8, borderRadius: "50%", background: c.color, margin: "0 auto 4px" }} />
              <div style={{ fontSize: c.size, color: c.color, fontWeight: c.bold ? 700 : 400, whiteSpace: "nowrap", textAlign: "center" }}>{c.name}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: COLORS.midGray, lineHeight: 1.6, marginTop: 16 }}>
          Tradify occupies the only position in the bottom-right quadrant: affordable AND enforcement-driven. TradeControl is nearby but lacks cloud infrastructure, AI, and MT5 integration.
        </div>
      </Page>

      {/* PAGE 5 — WHITE SPACE & OPPORTUNITIES */}
      <Page pageNum={5}>
        <SectionTitle>White Space & Opportunities</SectionTitle>
        <h3 style={{ fontSize: 13, color: COLORS.white, fontWeight: 600, marginBottom: 14 }}>GAPS NO ONE SERVES WELL</h3>
        {[
          { title: "Real-Time Rule Enforcement", desc: "Every competitor logs violations after the trade. No one prevents bad trades before execution. Tradify's strategy validation engine is the only pre-trade enforcement mechanism in the market." },
          { title: "Integrated Prop Firm Challenge Tracking", desc: "Prop firm traders juggle separate spreadsheets for challenge rules (max drawdown, daily loss limits, profit targets). No journal embeds this natively with AI risk analysis. TradeZella has basic support; Edgewonk can import from FTMO — but neither enforces challenge rules." },
          { title: "Trader Education + Journaling", desc: "19-lesson education system with gamified progression doesn't exist anywhere else. Competitors assume traders already know how to trade. Tradify teaches AND tracks." },
          { title: "Free Tier with AI Features", desc: "TradesViz offers the only meaningful free tier, but it's analytics-only (stocks). Tradify's free tier includes the full journal, strategies, and education — the AI features gate at Pro/Elite." },
          { title: "Founding Member / Loyalty Programs", desc: "No competitor has a founding member program, early access benefits, or lifetime pricing. This creates switching costs and community that pure SaaS subscriptions don't." },
        ].map((g) => (
          <div key={g.title} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: COLORS.emerald, fontWeight: 600, marginBottom: 6 }}>▸ {g.title}</div>
            <div style={{ fontSize: 10, lineHeight: 1.7, paddingLeft: 16 }}>{g.desc}</div>
          </div>
        ))}

        <h3 style={{ fontSize: 13, color: COLORS.white, fontWeight: 600, marginTop: 24, marginBottom: 14 }}>KANO ANALYSIS — COMPETITOR FEATURES</h3>
        <Table
          headers={["Category", "Feature", "Today", "In 12 Months"]}
          rows={[
            ["Basic (table stakes)", "Trade journal & analytics", "Table stakes", "Still basic"],
            ["Basic", "Broker import / CSV upload", "Expected", "Commoditized"],
            ["Performance", "AI-powered insights", "Differentiator", "Becoming basic"],
            ["Performance", "Psychology/mood tracking", "Differentiator", "Becoming basic"],
            ["Delighter", "Real-time rule enforcement", "Unique to Tradify", "Category-defining"],
            ["Delighter", "Prop firm challenge tracker", "Rare", "Becoming performance"],
            ["Delighter", "Gamified education system", "Unique to Tradify", "Potential moat"],
          ]}
          colWidths={["18%", "28%", "27%", "27%"]}
        />
      </Page>

      {/* PAGE 6 — ACTION PLAN */}
      <Page pageNum={6}>
        <SectionTitle>Action Plan & Battlecard</SectionTitle>
        <h3 style={{ fontSize: 13, color: COLORS.white, fontWeight: 600, marginBottom: 16 }}>TOP 3 STRATEGIC ACTIONS</h3>

        {[
          {
            title: 'ACTION 1: Create the "Discipline Enforcement" Category',
            details: [
              "Position all marketing around 'enforcement, not logging.' No competitor uses this language.",
              'Every competitor says "track your trades" — Tradify should say "we stop you from breaking your rules."',
              "Create comparison landing pages: 'Tradify vs TraderSync', 'Tradify vs Edgewonk' targeting '[competitor] alternative' search queries.",
              "Source: TraderSync reviews mention wanting 'something that actually stops me' — this is unserved demand.",
            ],
          },
          {
            title: "ACTION 2: Dominate the Prop Firm Segment",
            details: [
              "500K+ traders are active in prop firm challenges at any time. None have a dedicated tracking + enforcement tool.",
              "Partner with prop firm affiliate programs (FTMO, TopStep, Funded Next) for cross-promotion.",
              "Create targeted content: 'How to Pass Your FTMO Challenge with Tradify' targeting each major firm.",
              "The free tier captures prop firm traders during their challenge; Pro/Elite converts them after they get funded.",
            ],
          },
          {
            title: "ACTION 3: Accelerate the Founding Member Flywheel",
            details: [
              "16/500 slots filled. Create countdown urgency in all marketing: '484 founding spots remaining.'",
              "Founding members at 30% lifetime discount become evangelists. Referral program amplifies this.",
              "No competitor offers anything comparable — TraderSync's annual discount is temporary; Tradify's is permanent.",
              "Target: Fill 100 founding spots in 90 days through X/Twitter content + prop firm community outreach.",
            ],
          },
        ].map((action) => (
          <div key={action.title} style={{ marginBottom: 20 }}>
            <div style={{ background: COLORS.darkCard, padding: "8px 14px", borderRadius: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: COLORS.emerald, fontWeight: 600 }}>{action.title}</span>
            </div>
            {action.details.map((d, i) => (
              <Bullet key={i}>{d}</Bullet>
            ))}
          </div>
        ))}

        <h3 style={{ fontSize: 13, color: COLORS.white, fontWeight: 600, marginTop: 20, marginBottom: 14 }}>BATTLECARD — TRAP-SETTING QUESTIONS</h3>
        {[
          { target: "vs TraderSync", q: '"Does your current journal actually prevent you from breaking rules, or does it just show you what happened after?" (TraderSync only logs — it doesn\'t enforce.)' },
          { target: "vs Edgewonk", q: '"What happens when you know your psychology is the problem but you still can\'t stop yourself from revenge trading?" (Edgewonk tracks mood — it doesn\'t lock you out.)' },
          { target: "vs TradeZella", q: '"Are you paying $49/mo for a journal that can\'t even tell you if you\'re about to fail your prop firm challenge?" (TradeZella has no AI risk analysis for challenges.)' },
          { target: "vs Spreadsheets", q: '"How many hours a week do you spend manually updating your trading spreadsheet instead of actually trading?" (Most traders spend 3-5 hours — Tradify automates it with MT5 sync.)' },
        ].map((b) => (
          <div key={b.target} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: COLORS.emerald, fontWeight: 600, marginBottom: 4 }}>{b.target}</div>
            <div style={{ fontSize: 9, lineHeight: 1.6, paddingLeft: 12, fontStyle: "italic" }}>{b.q}</div>
          </div>
        ))}
      </Page>

      {/* PAGE 7 — SOURCES */}
      <Page pageNum={7}>
        <SectionTitle>Sources</SectionTitle>
        {[
          'StockBrokers.com — "5 Best Trading Journals for 2026" — stockbrokers.com/guides/best-trading-journals',
          'Tradervue Blog — "7 Best Trading Journals 2026" — tradervue.com/blog/best-trading-journal',
          'Tradeciety — "Best Trading Journals 2026" — tradeciety.com/best-online-trading-journals',
          'TradeLens — "Best Trade Journal Apps 2025 Comparison" — tradelens.vip/resources/best-trade-journal-apps',
          'TradesViz Blog — "Best Trading Journal 2026 Comparison" — tradesviz.com/blog/best-trading-journal-2026-comparison/',
          'UltraTrader Blog — "Best Trading Journal Apps 2026" — blog.ultratrader.app/best-trading-journal-apps-ios-and-android/',
          'M1NDTR8DE — "Best Trading Journals 2026: 7 Tools Compared" — m1nd.app/blog/best-trading-journals-2026',
          'DayTradingZ — "5 Best Trading Journals of 2026" — daytradingz.com/best-trading-journal/',
          "G2 — Brokerage Trading Platforms Category — g2.com/categories/brokerage-trading-platforms",
          "G2 — TradingView Competitors & Alternatives — g2.com/products/tradingview/competitors/alternatives",
          "TraderSync.com — Official pricing & features — tradersync.com",
          "Edgewonk.com — Official pricing & features — edgewonk.com",
          "TradeZella.com — Official pricing & features — tradezella.com",
          "TradesViz.com — Official pricing & features — tradesviz.com",
          "Tradervue.com — Official pricing & features — tradervue.com",
          "TradeControl.app — Official features — tradecontrol.app",
          "Trademetria.com — Official pricing & features — trademetria.com",
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 9, lineHeight: 1.5 }}>
            <span style={{ color: COLORS.midGray, flexShrink: 0, width: 24 }}>[{i + 1}]</span>
            <span>{s}</span>
          </div>
        ))}
      </Page>
    </div>
  );
}
