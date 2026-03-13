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
    title: "TradifyApp – Trading Discipline Platform for Prop Traders",
    description: "80% of traders fail prop firm challenges because they break their own rules. TradifyApp enforces discipline, auto-syncs MT5 trades, and tracks drawdown live. Free plan available.",
    canonical: `${BASE_URL}/`,
  },
  "/features": {
    title: "Features – Rule Enforcement, MT5 Sync & Prop Firm Tracker | TradifyApp",
    description: "Explore TradifyApp's features: automated MT5 trade sync, real-time rule validation, prop firm challenge tracking, AI behavioral insights, and strategy compliance scoring.",
    canonical: `${BASE_URL}/features`,
  },
  "/pricing": {
    title: "Pricing – Free, Pro & Elite Plans | TradifyApp",
    description: "TradifyApp offers a free plan with core trading discipline tools. Upgrade to Pro ($29/mo) for the prop firm tracker and AI analysis, or Elite ($59/mo) for full behavioral intelligence.",
    canonical: `${BASE_URL}/pricing`,
  },
  "/how-it-works": {
    title: "How TradifyApp Works – Connect MT5, Enforce Rules, Track Challenges",
    description: "Connect your MT5 account, define your trading rules, and let TradifyApp auto-sync every trade, flag rule violations, and track your prop firm challenge in real time.",
    canonical: `${BASE_URL}/how-it-works`,
  },
  "/about": {
    title: "About TradifyApp – Our Mission & Story",
    description: "TradifyApp exists to solve the discipline crisis in trading. Learn about our mission to help traders enforce their own rules and pass prop firm challenges consistently.",
    canonical: `${BASE_URL}/about`,
  },
  "/blog": {
    title: "Trading Insights & Guides | TradifyApp Blog",
    description: "Read in-depth guides on trading discipline, prop firm challenge strategy, MT5 analytics, and behavioral risk management from the TradifyApp team.",
    canonical: `${BASE_URL}/blog`,
  },
  "/resources": {
    title: "Trading Resources & Educational Content | TradifyApp",
    description: "Free trading resources, discipline guides, risk calculators, and educational content to help you pass prop firm challenges and trade consistently.",
    canonical: `${BASE_URL}/resources`,
  },
  "/demo": {
    title: "See TradifyApp in Action – Step-by-Step Demo",
    description: "A visual walkthrough of how TradifyApp works: connect MT5, define rules, auto-sync trades, track your prop firm challenge, and get AI discipline insights.",
    canonical: `${BASE_URL}/demo`,
  },
  "/checklist": {
    title: "Free Pre-Trade Checklist for Disciplined Traders | TradifyApp",
    description: "Download the free pre-trade checklist used by disciplined traders. Covers HTF bias, entry validation, risk management, and psychology checks. Print and use before every trade.",
    canonical: `${BASE_URL}/checklist`,
  },
  "/trading-journal": {
    title: "Trading Journal Software with MT5 Auto-Sync | TradifyApp",
    description: "Stop manually logging trades. TradifyApp auto-syncs every MT5 trade to your journal with full P&L, behavioral notes, and strategy compliance tracking.",
    canonical: `${BASE_URL}/trading-journal`,
  },
  "/prop-firm-tracker": {
    title: "Prop Firm Challenge Tracker – Real-Time Risk Monitoring | TradifyApp",
    description: "Track your FTMO, MFF, or custom prop firm challenge in real time. Monitor drawdown, profit target progress, and consistency rules — all synced from your MT5 account.",
    canonical: `${BASE_URL}/prop-firm-tracker`,
  },
  "/mt5-trading-analytics": {
    title: "MT5 Trading Analytics & Performance Insights | TradifyApp",
    description: "Connect your MetaTrader 5 account and get deep analytics: equity curve, win rate, profit factor, session performance, and AI behavioral risk detection.",
    canonical: `${BASE_URL}/mt5-trading-analytics`,
  },
  "/terms": {
    title: "Terms of Service | TradifyApp",
    description: "Read the TradifyApp Terms of Service governing your use of the platform.",
    canonical: `${BASE_URL}/terms`,
  },
  "/privacy": {
    title: "Privacy Policy | TradifyApp",
    description: "Read TradifyApp's Privacy Policy to understand how we handle your data.",
    canonical: `${BASE_URL}/privacy`,
  },
  "/risk-disclaimer": {
    title: "Risk Disclaimer | TradifyApp",
    description: "Important risk disclosure for users of TradifyApp's trading discipline platform.",
    canonical: `${BASE_URL}/risk-disclaimer`,
  },
  "/cookie-policy": {
    title: "Cookie Policy | TradifyApp",
    description: "Read TradifyApp's Cookie Policy to understand how we use cookies.",
    canonical: `${BASE_URL}/cookie-policy`,
  },
  // Auth pages — noindex
  "/login": { title: "Login | TradifyApp", description: "Log in to TradifyApp.", canonical: `${BASE_URL}/login`, noindex: true },
  "/signup": { title: "Sign Up | TradifyApp", description: "Create your TradifyApp account.", canonical: `${BASE_URL}/signup`, noindex: true },
  "/early-access": { title: "Early Access | TradifyApp", description: "Join TradifyApp's early access program.", canonical: `${BASE_URL}/early-access`, noindex: true },
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
