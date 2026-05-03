import OpenAI from "openai";
import { storage } from "./storage";
import { trackAIUsage, calculateCost } from "./ai-cost-tracker";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL = "gpt-4o-mini";

export interface PlanInput {
  goal: string;
  audience: string;
  timeframe: string;
  budget: string;
  channels: string;
}

export interface MarketingPlan {
  summary: string;
  positioning: string;
  campaigns: {
    name: string;
    goal: string;
    channels: string[];
    budget: string;
    duration: string;
    kpis: string[];
  }[];
  calendar: {
    week: number;
    theme: string;
    posts: { day: string; platform: string; type: string; hook: string }[];
  }[];
  budgetBreakdown: { channel: string; pct: number; rationale: string }[];
  kpis: { metric: string; target: string }[];
}

async function buildBrandContext(): Promise<string> {
  try {
    const brand = await storage.getMarketingBrandSettings("admin");
    if (!brand) {
      return "Brand: Tradify — premium AI trading journal & analytics platform for forex, indices, and prop firm traders. Voice: confident, professional, empowering. Visual brand: jet black + emerald (#10b981).";
    }
    const usps = Array.isArray(brand.uniqueSellingPoints) ? brand.uniqueSellingPoints : [];
    const personas = Array.isArray(brand.targetAudiencePersonas) ? brand.targetAudiencePersonas : [];
    return `Brand: ${brand.brandName}. ${brand.description || ""} Voice: ${brand.brandVoice || "professional"}. Tone: ${brand.brandTone || "confident"}. USPs: ${JSON.stringify(usps)}. Personas: ${JSON.stringify(personas)}.`;
  } catch {
    return "Brand: Tradify — premium trading journal platform.";
  }
}

export async function generateMarketingPlan(input: PlanInput): Promise<MarketingPlan> {
  const brand = await buildBrandContext();

  const systemPrompt = `You are a senior marketing strategist with 15+ years of experience building 7-figure growth campaigns for fintech, SaaS, and creator brands. You think in funnels, channels, and measurable KPIs.

${brand}

You produce concrete, executable marketing plans — never vague generalities. Every campaign has a clear goal, channel, budget allocation, and success metric. Calendar entries are specific enough that a marketer could execute them today.

ALWAYS return valid JSON only, no markdown fences, no commentary.`;

  const userPrompt = `Create a complete marketing plan with this brief:

GOAL: ${input.goal}
AUDIENCE: ${input.audience}
TIMEFRAME: ${input.timeframe}
BUDGET: ${input.budget}
CHANNELS: ${input.channels}

Return ONLY this JSON shape (no extra keys, no commentary):
{
  "summary": "2-3 sentence executive summary of the strategy",
  "positioning": "one sharp positioning sentence — who we are, who we serve, what makes us different",
  "campaigns": [
    {
      "name": "campaign name",
      "goal": "specific outcome",
      "channels": ["channel1", "channel2"],
      "budget": "$X",
      "duration": "e.g. Week 1-2",
      "kpis": ["metric1: target", "metric2: target"]
    }
  ],
  "calendar": [
    {
      "week": 1,
      "theme": "weekly theme",
      "posts": [
        {"day": "Mon", "platform": "Instagram", "type": "Reel", "hook": "specific hook for this post"},
        {"day": "Tue", "platform": "TikTok", "type": "UGC video", "hook": "specific hook"}
      ]
    }
  ],
  "budgetBreakdown": [
    {"channel": "Meta Ads", "pct": 40, "rationale": "why this allocation"}
  ],
  "kpis": [
    {"metric": "CAC", "target": "<$15"},
    {"metric": "Free→Pro conversion", "target": "5%"}
  ]
}

Requirements:
- Generate 3-5 campaigns
- Generate exactly 4 weeks of calendar with 4-6 posts per week
- Budget percentages must sum to 100
- KPIs must be measurable numbers
- Hooks must be specific copy, not topic descriptions`;

  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  });
  const duration = Date.now() - startTime;

  const usage = response.usage;
  trackAIUsage({
    userId: "admin",
    userTier: "ADMIN",
    feature: "studio_marketing_plan",
    model: MODEL,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    costUsd: calculateCost(MODEL, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
    requestDuration: duration,
  }).catch((err) => console.error("[AI Cost Tracker] studio_plan error:", err));

  const raw = response.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  return {
    summary: parsed.summary || "",
    positioning: parsed.positioning || "",
    campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
    calendar: Array.isArray(parsed.calendar) ? parsed.calendar : [],
    budgetBreakdown: Array.isArray(parsed.budgetBreakdown) ? parsed.budgetBreakdown : [],
    kpis: Array.isArray(parsed.kpis) ? parsed.kpis : [],
  };
}
