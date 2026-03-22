import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

const BASE_URL = "https://tradifyapp.com";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = "TradifyApp";

function isBot(ua: string): boolean {
  const patterns = [
    "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider",
    "yandexbot", "facebookexternalhit", "twitterbot", "linkedinbot",
    "whatsapp", "slackbot", "telegrambot", "discordbot", "applebot",
    "ia_archiver", "msnbot", "teoma", "sogou", "exabot", "crawler",
    "spider", "curl/", "wget/", "python-requests", "go-http-client",
    "jakarta commons", "openai", "gptbot",
  ];
  const lower = ua.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  noindex?: boolean;
  image?: string;
}

const STATIC_PAGES: Record<string, PageMeta> = {
  "/": {
    title: "TradifyApp - Trading Discipline Platform | Enforce Your Rules, Pass Prop Challenges",
    description: "80% of traders fail prop challenges because they break their own rules. TradifyApp enforces your trading rules, tracks drawdown in real time, and stops revenge trading before it starts. Free plan available.",
    canonical: `${BASE_URL}/`,
  },
  "/features": {
    title: "Features - Trade Visualization & Analytics | TradifyApp",
    description: "Explore TradifyApp features: live MT5 sync, equity curves, performance analytics, behavioral insights, and strategy validation for disciplined trading.",
    canonical: `${BASE_URL}/features`,
  },
  "/pricing": {
    title: "Pricing - Free, Pro & Elite Plans | TradifyApp",
    description: "Choose your TradifyApp plan. Free MT5 sync, Pro analytics at $29/mo, or Elite with AI insights at $59/mo. Founding members get 30% off forever.",
    canonical: `${BASE_URL}/pricing`,
  },
  "/how-it-works": {
    title: "How It Works - Simple MT5 Integration | TradifyApp",
    description: "Learn how TradifyApp works: connect your MT5, sync trades automatically, build strategies, and track your trading performance in 3 simple steps.",
    canonical: `${BASE_URL}/how-it-works`,
  },
  "/about": {
    title: "About TradifyApp - Trading Discipline Platform",
    description: "TradifyApp is a discipline enforcement platform for serious traders. Auto-sync MT5 trades, validate rules before every entry, and track prop firm challenges in real time. No signals, no predictions — just discipline.",
    canonical: `${BASE_URL}/about`,
  },
  "/blog": {
    title: "Blog - Trading Insights & Strategy Tips | TradifyApp",
    description: "Trading insights, strategy tips, and platform updates from TradifyApp. Learn disciplined trading with expert articles on prop firm challenges, MT5 analytics, and risk management.",
    canonical: `${BASE_URL}/blog`,
  },
  "/resources": {
    title: "Resources - Trading Education & Tools | TradifyApp",
    description: "Access TradifyApp trading resources: risk calculators, educational content, strategy guides, and professional tools to improve your trading discipline.",
    canonical: `${BASE_URL}/resources`,
  },
  "/demo": {
    title: "See TradifyApp in Action - Step-by-Step Demo",
    description: "A visual walkthrough of how TradifyApp works: connect MT5, define rules, auto-sync trades, track your prop firm challenge, and get AI discipline insights.",
    canonical: `${BASE_URL}/demo`,
  },
  "/checklist": {
    title: "Free Pre-Trade Checklist for Disciplined Traders | TradifyApp",
    description: "Download the free pre-trade checklist used by disciplined traders. Covers HTF bias, entry validation, risk management, and psychology checks. Print and use before every trade.",
    canonical: `${BASE_URL}/checklist`,
  },
  "/trading-journal": {
    title: "Best MT5 Trading Journal Software - Auto-Sync & Rule Validation | TradifyApp",
    description: "The #1 MT5 trading journal that auto-syncs every trade, validates entries against your rules, and tracks performance with AI analytics. Free plan available. No manual logging.",
    canonical: `${BASE_URL}/trading-journal`,
  },
  "/prop-firm-tracker": {
    title: "Prop Firm Challenge Tracker - Track Drawdowns & Profit Targets in Real Time | TradifyApp",
    description: "Never fail a prop firm challenge again. TradifyApp tracks your drawdown limits, profit targets, consistency scores, and days remaining in real time. Supports FTMO, MFF, TFT & custom configs.",
    canonical: `${BASE_URL}/prop-firm-tracker`,
  },
  "/mt5-trading-analytics": {
    title: "MT5 Trading Analytics & Performance Tracker - AI-Powered Insights | TradifyApp",
    description: "Track your MT5 trading performance with AI-powered analytics. Equity curves, win rate by instrument, session analysis, drawdown tracking, and behavioral insights. Auto-syncs from MetaTrader 5.",
    canonical: `${BASE_URL}/mt5-trading-analytics`,
  },
  "/terms": {
    title: "Terms of Service | TradifyApp",
    description: "Read TradifyApp's Terms of Service. Understand your rights and responsibilities when using our trading journal and MT5 sync platform.",
    canonical: `${BASE_URL}/terms`,
  },
  "/privacy": {
    title: "Privacy Policy | TradifyApp",
    description: "TradifyApp's Privacy Policy explains how we collect, use, and protect your trading data and personal information. GDPR compliant.",
    canonical: `${BASE_URL}/privacy`,
  },
  "/risk-disclaimer": {
    title: "Risk Disclaimer | TradifyApp",
    description: "Important risk disclosure for TradifyApp users. Trading forex and CFDs involves substantial risk. Read our full risk disclaimer before trading.",
    canonical: `${BASE_URL}/risk-disclaimer`,
  },
  "/cookie-policy": {
    title: "Cookie Policy | TradifyApp",
    description: "Learn how TradifyApp uses cookies. Manage your preferences for analytics and marketing cookies. GDPR compliant cookie consent.",
    canonical: `${BASE_URL}/cookie-policy`,
  },
  "/login": { title: "Login | TradifyApp", description: "Log in to your TradifyApp account to access your trading journal and analytics.", canonical: `${BASE_URL}/login`, noindex: true },
  "/signup": { title: "Sign Up | TradifyApp", description: "Create your free TradifyApp account. Start tracking your MT5 trades and enforcing discipline today.", canonical: `${BASE_URL}/signup`, noindex: true },
  "/early-access": { title: "Early Access | TradifyApp", description: "Join TradifyApp's early access program and be among the first to use the trading discipline platform.", canonical: `${BASE_URL}/early-access`, noindex: true },
};

function buildBotHtml(meta: PageMeta, ogType = "website"): string {
  const image = meta.image || DEFAULT_IMAGE;
  const robotsContent = meta.noindex ? "noindex, nofollow" : "index, follow";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}" />
  <meta name="robots" content="${robotsContent}" />
  <link rel="canonical" href="${meta.canonical}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${meta.title}" />
  <meta property="og:description" content="${meta.description}" />
  <meta property="og:url" content="${meta.canonical}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tradifyapp" />
  <meta name="twitter:creator" content="@tradifyapp" />
  <meta name="twitter:title" content="${meta.title}" />
  <meta name="twitter:description" content="${meta.description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <h1>${meta.title}</h1>
  <p>${meta.description}</p>
</body>
</html>`;
}

export async function botSeoMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = req.headers["user-agent"] || "";
  if (!isBot(ua)) return next();

  const urlPath = req.path.replace(/\/$/, "") || "/";

  // Blog post pages
  if (urlPath.startsWith("/blog/") && urlPath !== "/blog/") {
    const slug = urlPath.replace("/blog/", "");
    try {
      const [post] = await db
        .select({ title: schema.blogPosts.title, excerpt: schema.blogPosts.excerpt, slug: schema.blogPosts.slug, coverImage: schema.blogPosts.coverImage })
        .from(schema.blogPosts)
        .where(eq(schema.blogPosts.slug, slug))
        .limit(1);

      if (post) {
        const meta: PageMeta = {
          title: `${post.title} | TradifyApp Blog`,
          description: post.excerpt || `Read ${post.title} on the TradifyApp trading discipline blog.`,
          canonical: `${BASE_URL}/blog/${post.slug}`,
          image: post.coverImage || DEFAULT_IMAGE,
        };
        return res.status(200).set("Content-Type", "text/html").send(buildBotHtml(meta, "article"));
      }
    } catch {
      // fall through
    }
    return next();
  }

  const meta = STATIC_PAGES[urlPath] || STATIC_PAGES[req.path];
  if (!meta) return next();

  res.status(200).set("Content-Type", "text/html").send(buildBotHtml(meta));
}
