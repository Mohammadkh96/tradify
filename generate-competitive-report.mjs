import { jsPDF } from "jspdf";
import fs from "fs";

const MARGIN = 36;
const PAGE_W = 612;
const PAGE_H = 792;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const CONTENT_H = PAGE_H - 2 * MARGIN;

const COLORS = {
  darkBg: [10, 15, 30],
  emerald: [0, 217, 163],
  white: [255, 255, 255],
  lightGray: [200, 200, 210],
  midGray: [140, 140, 160],
  darkCard: [18, 25, 45],
  green: [34, 197, 94],
  red: [239, 68, 68],
  amber: [245, 158, 11],
  blue: [59, 130, 246],
};

function addHeader(doc, pageNum, totalPages) {
  const savedY = doc.__currentY;
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text("TRADIFY COMPETITIVE ANALYSIS — CONFIDENTIAL", MARGIN, 20);
  doc.text(`April 2026`, PAGE_W - MARGIN, 20, { align: "right" });
  doc.setDrawColor(...COLORS.emerald);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 25, PAGE_W - MARGIN, 25);
  doc.__currentY = savedY;
}

function addFooter(doc, pageNum, totalPages) {
  const savedY = doc.__currentY;
  doc.setDrawColor(...COLORS.midGray);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 30, PAGE_W - MARGIN, PAGE_H - 30);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text("tradifyapp.com", MARGIN, PAGE_H - 20);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 20, { align: "right" });
  doc.__currentY = savedY;
}

function newPage(doc) {
  doc.addPage();
  doc.__pageNum++;
  doc.__currentY = MARGIN + 15;
  doc.__isNewPage = true;
}

function ensureSpace(doc, needed) {
  if (doc.__currentY + needed > PAGE_H - MARGIN - 35) {
    newPage(doc);
    return true;
  }
  return false;
}

function sectionTitle(doc, text) {
  ensureSpace(doc, 40);
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.emerald);
  doc.text(text.toUpperCase(), MARGIN, doc.__currentY);
  doc.__currentY += 5;
  doc.setDrawColor(...COLORS.emerald);
  doc.setLineWidth(1);
  doc.line(MARGIN, doc.__currentY, MARGIN + 120, doc.__currentY);
  doc.__currentY += 15;
}

function bodyText(doc, text, opts = {}) {
  const fontSize = opts.fontSize || 9;
  const color = opts.color || COLORS.lightGray;
  const maxW = opts.maxWidth || CONTENT_W;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxW);
  const lineH = fontSize * 0.45;
  for (const line of lines) {
    ensureSpace(doc, lineH + 2);
    doc.text(line, opts.x || MARGIN, doc.__currentY);
    doc.__currentY += lineH + 1.5;
  }
  doc.__currentY += 3;
}

function bulletPoint(doc, text, opts = {}) {
  const indent = opts.indent || 10;
  ensureSpace(doc, 12);
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.emerald);
  doc.text("▸", MARGIN + indent - 8, doc.__currentY);
  doc.setTextColor(...(opts.color || COLORS.lightGray));
  const lines = doc.splitTextToSize(text, CONTENT_W - indent - 5);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) ensureSpace(doc, 12);
    doc.text(lines[i], MARGIN + indent, doc.__currentY);
    doc.__currentY += 5.5;
  }
}

function drawTable(doc, headers, rows, opts = {}) {
  const colWidths = opts.colWidths || headers.map(() => CONTENT_W / headers.length);
  const cellPad = 4;
  const rowH = opts.rowHeight || 16;
  const headerH = 18;

  ensureSpace(doc, headerH + rowH * Math.min(rows.length, 3));

  let x = MARGIN;
  doc.setFillColor(15, 20, 38);
  doc.rect(MARGIN, doc.__currentY - 4, CONTENT_W, headerH, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.emerald);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x + cellPad, doc.__currentY + 6);
    x += colWidths[i];
  }
  doc.__currentY += headerH;

  for (let r = 0; r < rows.length; r++) {
    ensureSpace(doc, rowH + 2);
    if (r % 2 === 0) {
      doc.setFillColor(12, 17, 32);
      doc.rect(MARGIN, doc.__currentY - 4, CONTENT_W, rowH, "F");
    }
    x = MARGIN;
    doc.setFontSize(7.5);
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      if (cell === "✓") {
        doc.setTextColor(...COLORS.green);
      } else if (cell === "✗") {
        doc.setTextColor(...COLORS.red);
      } else if (cell === "~") {
        doc.setTextColor(...COLORS.amber);
      } else {
        doc.setTextColor(...COLORS.lightGray);
      }
      const cellText = doc.splitTextToSize(String(cell), colWidths[c] - cellPad * 2);
      doc.text(cellText[0] || "", x + cellPad, doc.__currentY + 5);
      x += colWidths[c];
    }
    doc.__currentY += rowH;
  }
  doc.__currentY += 8;
}

function generate() {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.__currentY = MARGIN;
  doc.__pageNum = 1;
  doc.__isNewPage = true;
  const TOTAL_PAGES = 7;

  // ============ PAGE 1 — TITLE / EXECUTIVE SUMMARY ============
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  doc.__currentY = 120;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.emerald);
  doc.text("COMPETITIVE ANALYSIS", MARGIN, doc.__currentY);
  doc.__currentY += 35;

  doc.setFontSize(32);
  doc.setTextColor(...COLORS.white);
  doc.text("TRADIFY", MARGIN, doc.__currentY);
  doc.__currentY += 15;
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.lightGray);
  doc.text("Trading Discipline Platform", MARGIN, doc.__currentY);
  doc.__currentY += 8;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.emerald);
  doc.text("Your Rules. Enforced.", MARGIN, doc.__currentY);

  doc.__currentY += 30;
  doc.setDrawColor(...COLORS.emerald);
  doc.setLineWidth(1);
  doc.line(MARGIN, doc.__currentY, MARGIN + 80, doc.__currentY);
  doc.__currentY += 25;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.midGray);
  doc.text("April 2026  |  Confidential  |  v1.0", MARGIN, doc.__currentY);
  doc.__currentY += 40;

  doc.setFontSize(12);
  doc.setTextColor(...COLORS.emerald);
  doc.text("POSITIONING STATEMENT", MARGIN, doc.__currentY);
  doc.__currentY += 18;

  bodyText(doc, 'For retail and prop firm traders who consistently break their own rules and blow accounts, Tradify is a trading discipline platform that enforces your trading rules in real-time through MT5 integration, behavioral analysis, and AI-powered insights. Unlike TraderSync, Edgewonk, and TradeZella — which log trades after the fact — Tradify prevents bad trades before they happen.');

  doc.__currentY += 8;
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.emerald);
  doc.text("TOP 3 STRATEGIC RECOMMENDATIONS", MARGIN, doc.__currentY);
  doc.__currentY += 18;

  bulletPoint(doc, '1. OWN THE "DISCIPLINE ENFORCEMENT" CATEGORY — No major competitor enforces rules in real-time. TraderSync and Edgewonk track violations after the fact. Position Tradify as the only journal that actually prevents bad trades, not just records them.');
  bulletPoint(doc, '2. DOUBLE DOWN ON PROP FIRM TRADERS — TradeZella charges $29-49/mo for basic prop firm tracking. Tradify\'s integrated Challenge Tracker with AI Risk Analysis is a stronger value prop. Target the 500K+ active prop firm challenge participants.');
  bulletPoint(doc, '3. LEVERAGE THE FOUNDING MEMBER MOAT — At 16/500 founding members with lifetime 30% discounts, create urgency. Competitors have no equivalent loyalty program. This converts fence-sitters and builds a committed early user base.');

  addHeader(doc, 1, TOTAL_PAGES);
  addFooter(doc, 1, TOTAL_PAGES);

  // ============ PAGE 2 — COMPETITIVE LANDSCAPE ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "Competitive Landscape");

  bodyText(doc, "The trading journal market has 7 significant players. Most compete on analytics depth and broker integrations. None have built real-time rule enforcement — creating a clear category gap for Tradify.");
  doc.__currentY += 5;

  drawTable(doc,
    ["Competitor", "Est.", "Pricing", "Users", "Top Strength", "Key Weakness"],
    [
      ["TraderSync", "2013", "$30-80/mo", "N/A", "AI coaching (Cypher)", "No free tier, expensive"],
      ["Edgewonk", "2014", "$169/yr", "N/A", "Psychology tracking", "No AI, no replay"],
      ["TradeZella", "2021", "$29-49/mo", "N/A", "Trade replay", "No free trial, no refunds"],
      ["TradesViz", "2019", "$0-30/mo", "100K+", "Free tier (3K trades)", "Overwhelming UX"],
      ["Tradervue", "2011", "$0-50/mo", "207K+", "Community/mentorship", "Aging platform"],
      ["TradeControl", "2024", "Freemium", "New", "Circuit breaker lockout", "Very early stage"],
      ["Trademetria", "2016", "$0-30/mo", "80K+", "Gamified challenges", "Limited AI features"],
    ],
    { colWidths: [80, 30, 65, 45, 130, 130], rowHeight: 18 }
  );

  doc.__currentY += 5;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.emerald);
  doc.text("FUNDING & MARKET CONTEXT", MARGIN, doc.__currentY);
  doc.__currentY += 15;

  bulletPoint(doc, "Most competitors are bootstrapped or lightly funded. No VC-backed market leader has emerged.");
  bulletPoint(doc, "TraderSync is the most mature AI player ($30-80/mo) but has no free tier — creating an opening.");
  bulletPoint(doc, 'TradeControl is the only competitor attempting discipline enforcement, but it\'s browser-only with local storage — no cloud sync, no MT5 integration, very early stage.');
  bulletPoint(doc, "The prop firm industry (FTMO, TopStep, Funded Next) has 500K+ active challenge participants. No journal specifically targets this segment with integrated challenge tracking.");

  addHeader(doc, 2, TOTAL_PAGES);
  addFooter(doc, 2, TOTAL_PAGES);

  // ============ PAGE 3 — FEATURE MATRIX ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "Feature Comparison Matrix");
  bodyText(doc, "Features weighted by buyer importance (prop firm & retail traders). Green = available, Red = missing, Amber = partial.");
  doc.__currentY += 3;

  drawTable(doc,
    ["Feature (by weight)", "Tradify", "TraderSync", "Edgewonk", "TradeZella", "TradesViz", "Tradervue"],
    [
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
    ],
    { colWidths: [130, 70, 70, 70, 70, 70, 60], rowHeight: 15 }
  );

  doc.__currentY += 5;
  bodyText(doc, "KEY INSIGHT: Tradify wins on 10 of 16 features. The 3 gaps (trade replay, massive broker imports, mobile app) are future roadmap items. No competitor offers the combination of rule enforcement + prop firm tracking + AI insights + free tier.", { fontSize: 8, color: COLORS.emerald });

  addHeader(doc, 3, TOTAL_PAGES);
  addFooter(doc, 3, TOTAL_PAGES);

  // ============ PAGE 4 — PRICING COMPARISON ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "Pricing Comparison & Positioning Map");

  bodyText(doc, "Tradify's tiered pricing (Free / Pro / Elite) is competitive. The Founding Member program (30% lifetime discount) creates urgency no competitor matches.");
  doc.__currentY += 3;

  drawTable(doc,
    ["Platform", "Free Tier", "Entry Paid", "Mid Tier", "Top Tier", "Annual Discount"],
    [
      ["TRADIFY", "Yes (full)", "$9.99/mo Pro", "—", "$19.99/mo Elite", "Founding: 30% off"],
      ["TraderSync", "No", "$29.95/mo", "$49.95/mo", "$79.95/mo", "~35% annual"],
      ["Edgewonk", "No", "$169/yr flat", "—", "—", "N/A (one tier)"],
      ["TradeZella", "No", "$29/mo", "—", "$49/mo", "17-32% annual"],
      ["TradesViz", "Yes (stocks)", "$19.99/mo", "—", "$29.99/mo", "25% annual"],
      ["Tradervue", "30 trades", "$29.95/mo", "—", "$49.95/mo", "10-20% annual"],
      ["Trademetria", "30 trades", "$19.95/mo", "—", "$29.95/mo", "~16% annual"],
    ],
    { colWidths: [80, 70, 80, 70, 85, 95], rowHeight: 17 }
  );

  doc.__currentY += 10;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.emerald);
  doc.text("POSITIONING MAP (2x2)", MARGIN, doc.__currentY);
  doc.__currentY += 15;

  const mapX = MARGIN + 30;
  const mapY = doc.__currentY;
  const mapW = 350;
  const mapH = 200;

  doc.setDrawColor(...COLORS.midGray);
  doc.setLineWidth(0.5);
  doc.line(mapX, mapY + mapH / 2, mapX + mapW, mapY + mapH / 2);
  doc.line(mapX + mapW / 2, mapY, mapX + mapW / 2, mapY + mapH);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.midGray);
  doc.text("PASSIVE LOGGING", mapX - 5, mapY + mapH / 2 + 3, { align: "right" });
  doc.text("ACTIVE ENFORCEMENT", mapX + mapW + 5, mapY + mapH / 2 + 3);
  doc.text("EXPENSIVE", mapX + mapW / 2, mapY - 5, { align: "center" });
  doc.text("AFFORDABLE", mapX + mapW / 2, mapY + mapH + 12, { align: "center" });

  const competitors = [
    { name: "TRADIFY", x: 0.82, y: 0.7, color: COLORS.emerald },
    { name: "TraderSync", x: 0.45, y: 0.15, color: COLORS.blue },
    { name: "Edgewonk", x: 0.35, y: 0.65, color: COLORS.amber },
    { name: "TradeZella", x: 0.4, y: 0.25, color: COLORS.red },
    { name: "TradesViz", x: 0.3, y: 0.75, color: COLORS.lightGray },
    { name: "Tradervue", x: 0.25, y: 0.3, color: COLORS.lightGray },
    { name: "TradeControl", x: 0.7, y: 0.85, color: COLORS.midGray },
    { name: "Trademetria", x: 0.35, y: 0.65, color: COLORS.lightGray },
  ];

  for (const c of competitors) {
    const cx = mapX + c.x * mapW;
    const cy = mapY + (1 - c.y) * mapH;
    doc.setFillColor(...c.color);
    doc.circle(cx, cy, c.name === "TRADIFY" ? 5 : 3, "F");
    doc.setFontSize(c.name === "TRADIFY" ? 7.5 : 6.5);
    doc.setTextColor(...c.color);
    doc.text(c.name, cx + 7, cy + 2);
  }

  doc.__currentY = mapY + mapH + 25;
  bodyText(doc, "Tradify occupies the only position in the bottom-right quadrant: affordable AND enforcement-driven. TradeControl is nearby but lacks cloud infrastructure, AI, and MT5 integration.", { fontSize: 8 });

  addHeader(doc, 4, TOTAL_PAGES);
  addFooter(doc, 4, TOTAL_PAGES);

  // ============ PAGE 5 — WHITE SPACE & OPPORTUNITIES ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "White Space & Opportunities");

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text("GAPS NO ONE SERVES WELL", MARGIN, doc.__currentY);
  doc.__currentY += 15;

  const gaps = [
    ["Real-Time Rule Enforcement", "Every competitor logs violations after the trade. No one prevents bad trades before execution. Tradify's strategy validation engine is the only pre-trade enforcement mechanism in the market."],
    ["Integrated Prop Firm Challenge Tracking", "Prop firm traders juggle separate spreadsheets for challenge rules (max drawdown, daily loss limits, profit targets). No journal embeds this natively with AI risk analysis. TradeZella has basic support; Edgewonk can import from FTMO — but neither enforces challenge rules."],
    ["Trader Education + Journaling", "19-lesson education system with gamified progression doesn't exist anywhere else. Competitors assume traders already know how to trade. Tradify teaches AND tracks."],
    ["Free Tier with AI Features", "TradesViz offers the only meaningful free tier, but it's analytics-only (stocks). Tradify's free tier includes the full journal, strategies, and education — the AI features gate at Pro/Elite."],
    ["Founding Member / Loyalty Programs", "No competitor has a founding member program, early access benefits, or lifetime pricing. This creates switching costs and community that pure SaaS subscriptions don't."],
  ];

  for (const [title, desc] of gaps) {
    ensureSpace(doc, 45);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.emerald);
    doc.text(`▸ ${title}`, MARGIN, doc.__currentY);
    doc.__currentY += 12;
    bodyText(doc, desc, { fontSize: 8, x: MARGIN + 10 });
    doc.__currentY += 3;
  }

  doc.__currentY += 5;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text("KANO ANALYSIS — COMPETITOR FEATURES", MARGIN, doc.__currentY);
  doc.__currentY += 15;

  drawTable(doc,
    ["Category", "Feature", "Today", "In 12 Months"],
    [
      ["Basic (table stakes)", "Trade journal & analytics", "Table stakes", "Still basic"],
      ["Basic", "Broker import / CSV upload", "Expected", "Commoditized"],
      ["Performance", "AI-powered insights", "Differentiator", "Becoming basic"],
      ["Performance", "Psychology/mood tracking", "Differentiator", "Becoming basic"],
      ["Delighter", "Real-time rule enforcement", "Unique to Tradify", "Category-defining"],
      ["Delighter", "Prop firm challenge tracker", "Rare", "Becoming performance"],
      ["Delighter", "Gamified education system", "Unique to Tradify", "Potential moat"],
    ],
    { colWidths: [100, 140, 120, 120], rowHeight: 16 }
  );

  addHeader(doc, 5, TOTAL_PAGES);
  addFooter(doc, 5, TOTAL_PAGES);

  // ============ PAGE 6 — ACTION PLAN ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "Action Plan & Battlecard");

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text("TOP 3 STRATEGIC ACTIONS", MARGIN, doc.__currentY);
  doc.__currentY += 18;

  const actions = [
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
        "Create targeted content: 'How to Pass Your FTMO Challenge with Tradify' — SEO landing pages for each major firm.",
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
  ];

  for (const action of actions) {
    ensureSpace(doc, 70);
    doc.setFillColor(15, 22, 42);
    doc.roundedRect(MARGIN, doc.__currentY - 5, CONTENT_W, 10, 2, 2, "F");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.emerald);
    doc.text(action.title, MARGIN + 8, doc.__currentY + 3);
    doc.__currentY += 18;
    for (const d of action.details) {
      bulletPoint(doc, d, { indent: 15 });
    }
    doc.__currentY += 8;
  }

  doc.__currentY += 5;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.text("BATTLECARD — TRAP-SETTING QUESTIONS", MARGIN, doc.__currentY);
  doc.__currentY += 15;

  const battlecards = [
    ["vs TraderSync", '"Does your current journal actually prevent you from breaking rules, or does it just show you what happened after?" (TraderSync only logs — it doesn\'t enforce.)'],
    ["vs Edgewonk", '"What happens when you know your psychology is the problem but you still can\'t stop yourself from revenge trading?" (Edgewonk tracks mood — it doesn\'t lock you out.)'],
    ["vs TradeZella", '"Are you paying $49/mo for a journal that can\'t even tell you if you\'re about to fail your prop firm challenge?" (TradeZella has no AI risk analysis for challenges.)'],
    ["vs Spreadsheets", '"How many hours a week do you spend manually updating your trading spreadsheet instead of actually trading?" (Most traders spend 3-5 hours — Tradify automates it with MT5 sync.)'],
  ];

  for (const [target, question] of battlecards) {
    ensureSpace(doc, 30);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.emerald);
    doc.text(target, MARGIN, doc.__currentY);
    doc.__currentY += 10;
    bodyText(doc, question, { fontSize: 7.5, x: MARGIN + 10 });
    doc.__currentY += 2;
  }

  addHeader(doc, 6, TOTAL_PAGES);
  addFooter(doc, 6, TOTAL_PAGES);

  // ============ PAGE 7 — SOURCES ============
  newPage(doc);
  doc.setFillColor(...COLORS.darkBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  sectionTitle(doc, "Sources");

  const sources = [
    "StockBrokers.com — '5 Best Trading Journals for 2026' — https://www.stockbrokers.com/guides/best-trading-journals",
    "Tradervue Blog — '7 Best Trading Journals 2026' — https://www.tradervue.com/blog/best-trading-journal",
    "Tradeciety — 'Best Trading Journals 2026' — https://tradeciety.com/best-online-trading-journals",
    "TradeLens — 'Best Trade Journal Apps 2025 Comparison' — https://www.tradelens.vip/resources/best-trade-journal-apps",
    "TradesViz Blog — 'Best Trading Journal 2026 Comparison' — https://www.tradesviz.com/blog/best-trading-journal-2026-comparison/",
    "UltraTrader Blog — 'Best Trading Journal Apps 2026' — https://blog.ultratrader.app/best-trading-journal-apps-ios-and-android/",
    "M1NDTR8DE — 'Best Trading Journals 2026: 7 Tools Compared' — https://m1nd.app/blog/best-trading-journals-2026",
    "DayTradingZ — '5 Best Trading Journals of 2026' — https://daytradingz.com/best-trading-journal/",
    "G2 — Brokerage Trading Platforms Category — https://www.g2.com/categories/brokerage-trading-platforms",
    "G2 — TradingView Competitors & Alternatives — https://www.g2.com/products/tradingview/competitors/alternatives",
    "TraderSync.com — Official pricing & features — https://tradersync.com",
    "Edgewonk.com — Official pricing & features — https://edgewonk.com",
    "TradeZella.com — Official pricing & features — https://tradezella.com",
    "TradesViz.com — Official pricing & features — https://tradesviz.com",
    "Tradervue.com — Official pricing & features — https://tradervue.com",
    "TradeControl.app — Official features — https://tradecontrol.app",
    "Trademetria.com — Official pricing & features — https://trademetria.com",
  ];

  for (let i = 0; i < sources.length; i++) {
    ensureSpace(doc, 14);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.midGray);
    doc.text(`[${i + 1}]`, MARGIN, doc.__currentY);
    doc.setTextColor(...COLORS.lightGray);
    const lines = doc.splitTextToSize(sources[i], CONTENT_W - 25);
    for (const line of lines) {
      doc.text(line, MARGIN + 20, doc.__currentY);
      doc.__currentY += 9;
    }
    doc.__currentY += 2;
  }

  addHeader(doc, 7, TOTAL_PAGES);
  addFooter(doc, 7, TOTAL_PAGES);

  const buffer = doc.output("arraybuffer");
  fs.writeFileSync("tradify-competitive-analysis.pdf", Buffer.from(buffer));
  console.log("PDF generated: tradify-competitive-analysis.pdf");
}

generate();
