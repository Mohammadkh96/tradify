import OpenAI from "openai";
import { storage } from "./storage";
import type { MarketingBrandSettings, MarketingContent } from "@shared/schema";
import { trackAIUsage, calculateCost } from "./ai-cost-tracker";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL = "gpt-4o-mini";

function buildBrandSystemPrompt(brand: MarketingBrandSettings | undefined): string {
  if (!brand) {
    return `You are a marketing content creator for Tradify — a trading journal and analytics platform for forex, indices, and commodities traders. Tradify helps traders track trades, maintain discipline, and improve performance through data-driven insights.

Brand Voice: Professional yet approachable, confident but not arrogant, educational and empowering.
Target Audience: Retail forex/CFD traders, prop firm traders, and aspiring traders who want to improve their performance.
Key USPs: AI-powered trade analytics, MT5 bridge integration, prop firm challenge tracker, rule-based compliance engine, community traders hub.`;
  }

  const personas = Array.isArray(brand.targetAudiencePersonas) ? brand.targetAudiencePersonas : [];
  const usps = Array.isArray(brand.uniqueSellingPoints) ? brand.uniqueSellingPoints : [];
  const competitors = Array.isArray(brand.competitors) ? brand.competitors : [];
  const colors = Array.isArray(brand.colors) ? brand.colors : [];
  const keyMessages = Array.isArray(brand.keyMessages) ? brand.keyMessages : [];

  return `You are a marketing content creator for ${brand.brandName}.
${brand.description ? `Description: ${brand.description}` : ""}
${brand.brandVoice ? `Brand Voice: ${brand.brandVoice}` : ""}
${brand.brandTone ? `Brand Tone: ${brand.brandTone}` : ""}
${personas.length > 0 ? `Target Audience Personas: ${JSON.stringify(personas)}` : ""}
${usps.length > 0 ? `Unique Selling Points: ${JSON.stringify(usps)}` : ""}
${competitors.length > 0 ? `Competitors (differentiate from these): ${JSON.stringify(competitors)}` : ""}
${keyMessages.length > 0 ? `Key Messages: ${JSON.stringify(keyMessages)}` : ""}
${colors.length > 0 ? `Brand Colors: ${JSON.stringify(colors)}` : ""}`;
}

function buildDeduplicationContext(recentContent: MarketingContent[]): string {
  if (recentContent.length === 0) return "";

  const summaries = recentContent.map((c, i) => {
    const hook = c.hook ? ` | Hook: "${c.hook}"` : "";
    const title = c.title ? ` | Title: "${c.title}"` : "";
    const preview = c.content.substring(0, 120);
    return `${i + 1}. [${c.platform}]${title}${hook} — "${preview}..."`;
  }).join("\n");

  return `\n\nIMPORTANT — DEDUPLICATION REQUIREMENT:
Below are the most recent pieces of content already created. You MUST create something COMPLETELY DIFFERENT.
DO NOT repeat any hooks, themes, angles, phrases, or main ideas from the following:

${summaries}

Generate fresh, original content with a new angle, different hook, and unique perspective.`;
}

async function getDataInsights(): Promise<string> {
  try {
    const allUsers = await storage.getAllUsers();
    const totalUsers = allUsers.length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const signupsThisWeek = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= weekAgo).length;
    const signupsThisMonth = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= monthAgo).length;

    const freeUsers = allUsers.filter(u => !u.subscriptionTier || u.subscriptionTier === "FREE").length;
    const proUsers = allUsers.filter(u => u.subscriptionTier === "PRO").length;
    const eliteUsers = allUsers.filter(u => u.subscriptionTier === "ELITE").length;
    const foundingMembers = allUsers.filter(u => u.foundingMember).length;

    return `\n\nREAL PLATFORM DATA (use naturally in content when relevant):
- Total registered users: ${totalUsers}
- Signups this week: ${signupsThisWeek}
- Signups this month: ${signupsThisMonth}
- Free users: ${freeUsers} | Pro users: ${proUsers} | Elite users: ${eliteUsers}
- Founding members: ${foundingMembers}
- Conversion context: ${totalUsers > 0 ? ((proUsers + eliteUsers) / totalUsers * 100).toFixed(1) : 0}% paid conversion`;
  } catch {
    return "";
  }
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  wordsA.forEach(word => {
    if (wordsB.has(word)) intersection++;
  });
  return intersection / Math.max(wordsA.size, wordsB.size);
}

export async function checkSimilarity(newContent: string, type: string): Promise<{ isSimilar: boolean; highestScore: number; similarTo?: string }> {
  const existing = await storage.getRecentMarketingContentByType(type, 30);
  let highestScore = 0;
  let similarTo: string | undefined;

  for (const item of existing) {
    const score = computeSimilarity(newContent, item.content);
    if (score > highestScore) {
      highestScore = score;
      similarTo = item.title || item.content.substring(0, 60);
    }
  }

  return {
    isSimilar: highestScore > 0.7,
    highestScore: Math.round(highestScore * 100),
    similarTo: highestScore > 0.7 ? similarTo : undefined,
  };
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 2000,
  });
  const duration = Date.now() - startTime;

  const usage = response.usage;
  trackAIUsage({
    userId: "admin",
    userTier: "ADMIN",
    feature: "marketing_content",
    model: MODEL,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    costUsd: calculateCost(MODEL, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
    requestDuration: duration,
  }).catch(err => console.error("[AI Cost Tracker] marketing_content error:", err));

  return response.choices[0]?.message?.content || "";
}

export async function generatePost(
  platform: string,
  contentType: string,
  topic?: string
): Promise<{
  content: string;
  caption: string;
  hashtags: string;
  bestPostingTime: string;
  hook: string;
  cta: string;
  similarity: { isSimilar: boolean; highestScore: number; similarTo?: string };
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const recentContent = await storage.getRecentMarketingContentByType("post", 25);
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + buildDeduplicationContext(recentContent);

  const platformGuidelines: Record<string, string> = {
    instagram: "Instagram: 2200 char max caption, visual-first, use line breaks for readability, 20-30 hashtags, use carousel/single image context",
    facebook: "Facebook: Longer form OK, conversational tone, encourage comments, 3-5 hashtags max, shareable content",
    twitter: "Twitter/X: 280 char limit, punchy and direct, 2-3 hashtags max, thread-friendly if needed",
    linkedin: "LinkedIn: Professional tone, thought leadership angle, 1300 char ideal, 3-5 hashtags, tag relevant topics",
    tiktok: "TikTok: Hook in first 3 words, casual/energetic tone, trend-aware, 3-5 hashtags, video caption format",
  };

  const userPrompt = `Create a ${contentType} social media post for ${platform}.
${topic ? `Topic/Focus: ${topic}` : "Choose a compelling topic relevant to the brand."}

Platform Guidelines: ${platformGuidelines[platform] || "General social media best practices"}

Content Type: ${contentType} (${contentType === "educational tip" ? "teach something valuable" : contentType === "feature highlight" ? "showcase a specific feature" : contentType === "testimonial" ? "social proof style" : contentType === "promotional" ? "drive action/signups" : "show the human side"})

Return your response in this EXACT JSON format:
{
  "caption": "The full post caption/text",
  "hook": "The opening line/hook that grabs attention",
  "cta": "The call-to-action",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ...",
  "bestPostingTime": "Best day and time to post (e.g., Tuesday 10am EST)"
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      caption: rawResponse,
      hook: rawResponse.split("\n")[0] || "",
      cta: "",
      hashtags: "",
      bestPostingTime: "Tuesday 10am EST",
    };
  }

  const fullContent = parsed.caption || rawResponse;
  const similarity = await checkSimilarity(fullContent, "post");

  return {
    content: fullContent,
    caption: parsed.caption || fullContent,
    hashtags: parsed.hashtags || "",
    bestPostingTime: parsed.bestPostingTime || "Tuesday 10am EST",
    hook: parsed.hook || "",
    cta: parsed.cta || "",
    similarity,
  };
}

export async function generateReelScript(
  goal: string,
  topic?: string
): Promise<{
  content: string;
  hook: string;
  problem: string;
  solution: string;
  cta: string;
  visualDirections: string;
  hookVariations: string[];
  similarity: { isSimilar: boolean; highestScore: number; similarTo?: string };
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const recentContent = await storage.getRecentMarketingContentByType("reel_script", 20);
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + buildDeduplicationContext(recentContent);

  const userPrompt = `Create a short-form video/reel script.
Goal: ${goal} (${goal === "awareness" ? "introduce the brand/concept" : goal === "signups" ? "drive user registrations" : "demonstrate a specific feature"})
${topic ? `Topic/Focus: ${topic}` : "Choose a compelling topic."}

The script should follow this structure:
1. HOOK (first 3 seconds — must stop the scroll)
2. PROBLEM (identify the pain point)
3. SOLUTION (introduce how the brand solves it)
4. CTA (clear call-to-action)

Return your response in this EXACT JSON format:
{
  "hook": "The 3-second hook line",
  "problem": "The problem statement (5-10 seconds)",
  "solution": "The solution presentation (10-15 seconds)",
  "cta": "The call-to-action (3-5 seconds)",
  "visualDirections": "Specific visual/filming directions for each section",
  "hookVariations": ["Alternative hook 1", "Alternative hook 2", "Alternative hook 3"],
  "fullScript": "The complete script written out naturally"
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      hook: rawResponse.split("\n")[0] || "",
      problem: "",
      solution: "",
      cta: "",
      visualDirections: "",
      hookVariations: [],
      fullScript: rawResponse,
    };
  }

  const fullContent = parsed.fullScript || rawResponse;
  const similarity = await checkSimilarity(fullContent, "reel_script");

  return {
    content: fullContent,
    hook: parsed.hook || "",
    problem: parsed.problem || "",
    solution: parsed.solution || "",
    cta: parsed.cta || "",
    visualDirections: parsed.visualDirections || "",
    hookVariations: parsed.hookVariations || [],
    similarity,
  };
}

export async function generateBlogArticle(
  topic?: string,
  seoKeyword?: string
): Promise<{
  content: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  hook: string;
  cta: string;
  similarity: { isSimilar: boolean; highestScore: number; similarTo?: string };
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const recentContent = await storage.getRecentMarketingContentByType("blog", 15);
  const dataInsights = await getDataInsights();

  const existingBlogs = recentContent.map(c => c.title || c.content.substring(0, 80)).join(", ");
  const topicOverlapWarning = existingBlogs
    ? `\nExisting blog topics (DO NOT repeat these): ${existingBlogs}`
    : "";

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + buildDeduplicationContext(recentContent) + topicOverlapWarning;

  const userPrompt = `Write a complete blog article.
${topic ? `Topic: ${topic}` : "Choose a high-value topic for the target audience."}
${seoKeyword ? `Primary SEO Keyword: ${seoKeyword} — weave this naturally throughout the article (title, first paragraph, subheadings, conclusion). Target 1-2% keyword density.` : ""}

Requirements:
- 800-1500 words
- Engaging introduction with a hook
- 3-5 subheadings (H2s)
- Actionable tips/insights
- Strong conclusion with CTA
- Written for traders who want to improve their performance

Return your response in this EXACT JSON format:
{
  "title": "The blog article title",
  "metaTitle": "SEO meta title (50-60 chars)",
  "metaDescription": "SEO meta description (150-160 chars)",
  "hook": "The opening hook/sentence",
  "content": "The full article in markdown format",
  "cta": "The closing call-to-action"
}`;

  const rawResponse = await callOpenAI(
    systemPrompt,
    userPrompt
  );

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      title: topic || "Untitled Article",
      metaTitle: topic || "Untitled",
      metaDescription: "",
      hook: "",
      content: rawResponse,
      cta: "",
    };
  }

  const fullContent = parsed.content || rawResponse;
  const similarity = await checkSimilarity(fullContent, "blog");

  return {
    content: fullContent,
    title: parsed.title || topic || "Untitled",
    metaTitle: parsed.metaTitle || parsed.title || "",
    metaDescription: parsed.metaDescription || "",
    hook: parsed.hook || "",
    cta: parsed.cta || "",
    similarity,
  };
}

export async function generateAdCopy(
  campaignGoal: string,
  audience: string
): Promise<{
  variations: Array<{
    primaryText: string;
    headline: string;
    description: string;
    framework: string;
    hook: string;
    cta: string;
  }>;
  similarity: { isSimilar: boolean; highestScore: number; similarTo?: string };
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const recentContent = await storage.getRecentMarketingContentByType("ad_copy", 20);
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + buildDeduplicationContext(recentContent) + `

You are an expert Meta Ads copywriter. You understand AIDA (Attention-Interest-Desire-Action), PAS (Problem-Agitate-Solve), and Hook-Story-Offer frameworks deeply.`;

  const userPrompt = `Create 5-7 ad copy variations for Meta Ads (Facebook/Instagram).
Campaign Goal: ${campaignGoal}
Target Audience: ${audience}

Each variation should use a DIFFERENT framework. Label each with the framework used.

Requirements per variation:
- Primary Text: The main ad copy (125-250 chars optimal for mobile, can go up to 500)
- Headline: Bold headline below the image (25-40 chars)
- Description: Secondary text (up to 30 chars)
- Must include a clear hook and CTA

Return your response in this EXACT JSON format:
{
  "variations": [
    {
      "primaryText": "The main ad body text",
      "headline": "Bold headline",
      "description": "Short description",
      "framework": "AIDA|PAS|Hook-Story-Offer|Social Proof|Direct Response|Fear of Missing Out|Contrast",
      "hook": "The opening hook",
      "cta": "The call-to-action"
    }
  ]
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { variations: [] };
  }

  const variations = parsed.variations || [];
  const allContent = variations.map((v: any) => v.primaryText || "").join(" ");
  const similarity = await checkSimilarity(allContent, "ad_copy");

  return { variations, similarity };
}

export async function generateEmailCampaign(
  emailType: string,
  segment: string
): Promise<{
  subjectLine: string;
  body: string;
  preheader: string;
  cta: string;
  similarity: { isSimilar: boolean; highestScore: number; similarTo?: string };
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const recentContent = await storage.getRecentMarketingContentByType("email", 20);
  const dataInsights = await getDataInsights();

  const existingSubjects = recentContent
    .filter(c => c.title)
    .map(c => c.title)
    .join(", ");

  const subjectWarning = existingSubjects
    ? `\nPast subject lines used (DO NOT repeat): ${existingSubjects}`
    : "";

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + buildDeduplicationContext(recentContent) + subjectWarning + `

You are an expert email marketing copywriter. You write emails that get opened, read, and clicked.`;

  const segmentContext: Record<string, string> = {
    all_users: "All registered users of the platform",
    early_access: "Early access waitlist subscribers who haven't registered yet",
    free: "Users on the free tier — potential upgrade targets",
    pro: "Paying Pro subscribers — retain and engage",
    elite: "Elite tier subscribers — VIP treatment, exclusive content",
    inactive: "Users who haven't logged in for 14+ days — re-engagement",
  };

  const userPrompt = `Create an email campaign.
Email Type: ${emailType} (${emailType === "welcome" ? "onboarding/welcome sequence" : emailType === "feature_announcement" ? "new feature or update announcement" : emailType === "re_engagement" ? "win back inactive users" : "promotional offer or upgrade push"})
Recipient Segment: ${segment} — ${segmentContext[segment] || segment}

Requirements:
- Subject line: 6-10 words, creates curiosity or urgency, NO spam trigger words
- Preheader: 40-100 chars, complements the subject line
- Body: Personal, conversational, scannable with short paragraphs
- Single clear CTA
- Appropriate tone for the segment

Return your response in this EXACT JSON format:
{
  "subjectLine": "The email subject line",
  "preheader": "The preheader/preview text",
  "body": "The full email body in HTML-friendly format",
  "cta": "The CTA text and context"
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {
      subjectLine: "Update from Tradify",
      preheader: "",
      body: rawResponse,
      cta: "",
    };
  }

  const fullContent = (parsed.subjectLine || "") + " " + (parsed.body || rawResponse);
  const similarity = await checkSimilarity(fullContent, "email");

  return {
    subjectLine: parsed.subjectLine || "Update from Tradify",
    body: parsed.body || rawResponse,
    preheader: parsed.preheader || "",
    cta: parsed.cta || "",
    similarity,
  };
}

export async function generateCampaignStrategy(
  goal: string,
  budget: string,
  audience: string
): Promise<{
  campaignType: string;
  campaignTypeReasoning: string;
  adSetStructure: any[];
  audienceTargeting: any;
  budgetAllocation: any;
  bidStrategy: string;
  bidStrategyReasoning: string;
  testingPhases: any[];
  setupInstructions: string[];
  content: string;
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + `

You are a Meta Ads strategist with deep expertise in Advantage+ campaigns, Andromeda targeting system, CBO (Campaign Budget Optimization), and 2025 Meta Ads best practices. You provide specific, actionable campaign structures — not generic advice.`;

  const userPrompt = `Build a complete Meta Ads campaign strategy.
Goal: ${goal}
Budget: ${budget}
Target Audience: ${audience}

Return your response in this EXACT JSON format:
{
  "campaignType": "advantage_plus|manual|cbo",
  "campaignTypeReasoning": "Why this campaign type was chosen",
  "adSetStructure": [
    {
      "name": "Ad Set Name",
      "audience": "Audience description",
      "budgetPercent": 40,
      "creativeCount": 3,
      "placement": "Placements"
    }
  ],
  "audienceTargeting": {
    "interests": ["interest1", "interest2"],
    "lookalike": "Lookalike strategy",
    "retargeting": "Retargeting strategy",
    "exclusions": ["exclusion1"]
  },
  "budgetAllocation": {
    "daily": "Daily budget amount",
    "testing": "Testing phase budget",
    "scaling": "Scaling phase budget",
    "breakdown": "Budget breakdown explanation"
  },
  "bidStrategy": "lowest_cost|cost_cap|bid_cap|target_cost",
  "bidStrategyReasoning": "Why this bid strategy",
  "testingPhases": [
    {
      "phase": "Phase name",
      "duration": "Duration",
      "goal": "Phase goal",
      "actions": ["Action 1", "Action 2"],
      "kpis": ["KPI 1", "KPI 2"]
    }
  ],
  "setupInstructions": [
    "Step 1: ...",
    "Step 2: ..."
  ]
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { content: rawResponse };
  }

  return {
    campaignType: parsed.campaignType || "cbo",
    campaignTypeReasoning: parsed.campaignTypeReasoning || "",
    adSetStructure: parsed.adSetStructure || [],
    audienceTargeting: parsed.audienceTargeting || {},
    budgetAllocation: parsed.budgetAllocation || {},
    bidStrategy: parsed.bidStrategy || "lowest_cost",
    bidStrategyReasoning: parsed.bidStrategyReasoning || "",
    testingPhases: parsed.testingPhases || [],
    setupInstructions: parsed.setupInstructions || [],
    content: rawResponse,
  };
}

export async function generateAudienceStrategy(
  budget: string,
  goal: string
): Promise<{
  broadTargeting: any;
  interestTargeting: any;
  lookalikeStrategy: any;
  retargetingFunnel: any;
  customAudienceInstructions: string[];
  content: string;
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + `

You are a Meta Ads audience targeting expert. You understand Andromeda (Meta's AI targeting system), broad targeting benefits, interest stacking, lookalike audiences, and retargeting funnel structures for 2025.`;

  const userPrompt = `Create a comprehensive audience targeting strategy for Meta Ads.
Budget: ${budget}
Goal: ${goal}

Return your response in this EXACT JSON format:
{
  "broadTargeting": {
    "recommendation": "When and why to use broad targeting",
    "settings": "Specific targeting settings",
    "bestFor": "Best use cases"
  },
  "interestTargeting": {
    "primaryInterests": ["interest1", "interest2"],
    "stackedAudiences": [{"name": "Stack name", "interests": ["a", "b"], "reasoning": "why"}],
    "exclusions": ["exclusion1"]
  },
  "lookalikeStrategy": {
    "sourceAudiences": ["Source 1", "Source 2"],
    "percentages": ["1%", "1-3%", "3-5%"],
    "layering": "How to layer lookalikes",
    "setupSteps": ["Step 1", "Step 2"]
  },
  "retargetingFunnel": {
    "topOfFunnel": {"audience": "Description", "window": "Days", "adType": "Type"},
    "middleOfFunnel": {"audience": "Description", "window": "Days", "adType": "Type"},
    "bottomOfFunnel": {"audience": "Description", "window": "Days", "adType": "Type"}
  },
  "customAudienceInstructions": [
    "Step 1: ...",
    "Step 2: ..."
  ]
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { content: rawResponse };
  }

  return {
    broadTargeting: parsed.broadTargeting || {},
    interestTargeting: parsed.interestTargeting || {},
    lookalikeStrategy: parsed.lookalikeStrategy || {},
    retargetingFunnel: parsed.retargetingFunnel || {},
    customAudienceInstructions: parsed.customAudienceInstructions || [],
    content: rawResponse,
  };
}

export async function calculateBudget(
  goal: string,
  timeline: string
): Promise<{
  minimumViableBudget: string;
  recommendedBudget: string;
  dailySpend: string;
  scalingRules: string[];
  phases: any[];
  content: string;
}> {
  const brand = await storage.getMarketingBrandSettings("admin");
  const dataInsights = await getDataInsights();

  const systemPrompt = buildBrandSystemPrompt(brand) + dataInsights + `

You are a Meta Ads budget optimization expert. You provide realistic, data-driven budget recommendations based on 2025 CPMs, CPCs, and conversion benchmarks for fintech/trading platform advertising.`;

  const userPrompt = `Calculate and recommend a Meta Ads budget.
Goal: ${goal}
Timeline: ${timeline}

Consider typical CPMs for fintech/trading niche ($15-40), average CTRs (0.8-2%), and expected conversion rates (2-8% for landing page, 15-30% for retargeting).

Return your response in this EXACT JSON format:
{
  "minimumViableBudget": "Total minimum budget with explanation",
  "recommendedBudget": "Recommended total budget with explanation",
  "dailySpend": "Recommended daily ad spend",
  "scalingRules": [
    "Rule 1: Scale by X% when CPA is under $Y for 3+ days",
    "Rule 2: ..."
  ],
  "phases": [
    {
      "name": "Phase name",
      "duration": "Duration",
      "dailyBudget": "Daily budget",
      "totalBudget": "Phase total",
      "focus": "Phase focus"
    }
  ]
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { content: rawResponse };
  }

  return {
    minimumViableBudget: parsed.minimumViableBudget || "",
    recommendedBudget: parsed.recommendedBudget || "",
    dailySpend: parsed.dailySpend || "",
    scalingRules: parsed.scalingRules || [],
    phases: parsed.phases || [],
    content: rawResponse,
  };
}

export async function generateOptimizationRules(
  campaignType: string
): Promise<{
  killRules: Array<{ condition: string; action: string; timeframe: string }>;
  scaleRules: Array<{ condition: string; action: string; timeframe: string }>;
  fatiguethresholds: Array<{ metric: string; threshold: string; action: string }>;
  dayPartingSuggestions: any;
  content: string;
}> {
  const brand = await storage.getMarketingBrandSettings("admin");

  const systemPrompt = buildBrandSystemPrompt(brand) + `

You are a Meta Ads optimization expert. You provide specific, actionable rules based on 2025 Meta Ads best practices for campaign management. You understand creative fatigue, day-parting, and when to kill vs scale ad sets.`;

  const userPrompt = `Generate optimization rules for a ${campaignType} Meta Ads campaign.

Campaign Type: ${campaignType} (${campaignType === "advantage_plus" ? "Advantage+ Shopping/App campaigns with AI-driven optimization" : campaignType === "cbo" ? "Campaign Budget Optimization with multiple ad sets" : "Manual bid/budget ad sets"})

Return your response in this EXACT JSON format:
{
  "killRules": [
    {"condition": "When to kill", "action": "What to do", "timeframe": "After how long"}
  ],
  "scaleRules": [
    {"condition": "When to scale", "action": "How to scale", "timeframe": "After how long"}
  ],
  "fatigueThresholds": [
    {"metric": "Metric to watch", "threshold": "When it hits X", "action": "What to do"}
  ],
  "dayPartingSuggestions": {
    "bestHours": "Best hours to run ads",
    "bestDays": "Best days of the week",
    "avoidTimes": "Times to reduce spend",
    "reasoning": "Why these times work for this niche"
  }
}`;

  const rawResponse = await callOpenAI(systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { content: rawResponse };
  }

  return {
    killRules: parsed.killRules || [],
    scaleRules: parsed.scaleRules || [],
    fatiguethresholds: parsed.fatigueThresholds || [],
    dayPartingSuggestions: parsed.dayPartingSuggestions || {},
    content: rawResponse,
  };
}

export function getCampaignPlaybooks(): any[] {
  return [
    {
      id: "100-signups-30-days",
      name: "100 Signups in 30 Days",
      overview: "A structured campaign to acquire 100 new registered users within 30 days using a combination of cold prospecting and retargeting.",
      budget: "$300-500 total ($10-17/day)",
      timeline: "30 days",
      structure: {
        campaignType: "cbo",
        adSets: [
          { name: "Cold — Interest Targeting", budgetPercent: 40, audience: "Trading/investing interests, age 21-45", creatives: 3 },
          { name: "Cold — Broad Targeting", budgetPercent: 30, audience: "Broad with Advantage+ audience, age 21-55", creatives: 3 },
          { name: "Retargeting — Website Visitors", budgetPercent: 20, audience: "Website visitors last 30 days, excl. registered", creatives: 2 },
          { name: "Retargeting — Engagement", budgetPercent: 10, audience: "FB/IG engagers last 14 days, excl. registered", creatives: 2 },
        ],
      },
      targeting: {
        interests: ["forex trading", "stock market", "day trading", "MetaTrader", "trading journal", "technical analysis"],
        exclusions: ["Existing users (custom audience)"],
        lookalike: "1% lookalike from registered users if 100+ user base",
      },
      copyAngles: [
        "Pain point: Losing money because you repeat the same trading mistakes",
        "Social proof: Join X traders already improving their win rate",
        "Feature highlight: Automatic MT5 sync — no manual journaling",
        "FOMO: Free Pro access for founding members (limited)",
      ],
      phases: [
        { name: "Testing (Days 1-7)", budget: "$10/day", goal: "Test 3 creatives per ad set, find winning combinations" },
        { name: "Optimization (Days 8-14)", budget: "$12/day", goal: "Kill underperformers, double down on winners" },
        { name: "Scaling (Days 15-30)", budget: "$15-17/day", goal: "Scale winning ad sets by 20-30%, add lookalike audiences" },
      ],
      kpis: {
        targetCPA: "$3-5 per registration",
        targetCTR: "1.5%+",
        targetConversionRate: "5-10%",
      },
    },
    {
      id: "retargeting-funnel",
      name: "Retargeting Funnel",
      overview: "Convert warm audiences (website visitors, social engagers, free users) into Pro subscribers using a multi-touch retargeting sequence.",
      budget: "$150-300 total ($5-10/day)",
      timeline: "30 days ongoing",
      structure: {
        campaignType: "manual",
        adSets: [
          { name: "Top — Page Viewers (7d)", budgetPercent: 30, audience: "Website visitors 1-7 days, excl. signed up", creatives: 3 },
          { name: "Mid — Signed Up Not Active", budgetPercent: 35, audience: "Registered but <3 trades logged", creatives: 2 },
          { name: "Bottom — Active Free Users", budgetPercent: 35, audience: "Free users with 10+ trades, excl. Pro", creatives: 2 },
        ],
      },
      targeting: {
        customAudiences: ["Website visitors (7/14/30 day windows)", "Free registered users", "Active free users (custom event)"],
        exclusions: ["Pro/Elite subscribers"],
      },
      copyAngles: [
        "Top: 'Still thinking about tracking your trades? Here is why top traders journal daily...'",
        "Mid: 'You signed up — now let Tradify show you where you are losing money'",
        "Bottom: 'You have logged X trades. Unlock AI insights + advanced analytics with Pro'",
      ],
      phases: [
        { name: "Setup (Day 1-3)", budget: "$5/day", goal: "Set up audiences, upload creatives, test tracking" },
        { name: "Run & Optimize (Day 4-30)", budget: "$7-10/day", goal: "Monitor frequency, refresh creatives every 7-10 days" },
      ],
      kpis: {
        targetCPA: "$8-15 per Pro conversion",
        targetROAS: "3x within 60 days",
        frequencyCap: "Max 3x per week per user",
      },
    },
    {
      id: "feature-launch",
      name: "Feature Launch Campaign",
      overview: "Drive awareness and adoption of a new feature through a 2-week concentrated campaign targeting existing users and cold audiences.",
      budget: "$200-400 total ($15-30/day)",
      timeline: "14 days",
      structure: {
        campaignType: "advantage_plus",
        adSets: [
          { name: "Existing Users — Feature Announcement", budgetPercent: 40, audience: "All registered users (custom audience)", creatives: 3 },
          { name: "Cold — Problem/Solution Angle", budgetPercent: 35, audience: "Interest targeting — trading tools seekers", creatives: 3 },
          { name: "Lookalike — Best Users", budgetPercent: 25, audience: "1-3% lookalike from most active users", creatives: 2 },
        ],
      },
      targeting: {
        interests: ["Trading software", "forex tools", "trading apps", "MetaTrader 5"],
        customAudiences: ["All registered users", "Most active users (custom event)"],
      },
      copyAngles: [
        "Announcement: 'NEW: [Feature Name] is live! Here is how it helps you trade better'",
        "Demo: 'Watch how [Feature] catches mistakes you keep missing'",
        "Social proof: 'Beta testers improved their win rate by X% using [Feature]'",
      ],
      phases: [
        { name: "Launch Blast (Days 1-3)", budget: "$20-30/day", goal: "Maximum reach to existing users, create buzz" },
        { name: "Sustain (Days 4-14)", budget: "$15/day", goal: "Continue reaching cold audiences, optimize for conversions" },
      ],
      kpis: {
        targetFeatureAdoption: "30% of active users try the feature",
        targetNewSignups: "50+ from cold audiences",
      },
    },
    {
      id: "free-trial-promo",
      name: "Free Trial Promo",
      overview: "Offer a limited-time free Pro trial to drive signups and create urgency. Convert trial users to paid subscribers.",
      budget: "$200-350 total ($10-15/day)",
      timeline: "21 days (7-day trial + 14-day follow-up)",
      structure: {
        campaignType: "cbo",
        adSets: [
          { name: "Cold — Urgency/FOMO", budgetPercent: 45, audience: "Interest targeting — active traders", creatives: 4 },
          { name: "Retargeting — Landing Page Visitors", budgetPercent: 30, audience: "Trial page visitors who didn't sign up", creatives: 2 },
          { name: "Email List — Reactivation", budgetPercent: 25, audience: "Email list of inactive/non-converted users", creatives: 2 },
        ],
      },
      targeting: {
        interests: ["day trading", "forex trading", "trading education", "financial markets"],
        customAudiences: ["Email list upload", "Landing page visitors"],
        exclusions: ["Current Pro/Elite subscribers"],
      },
      copyAngles: [
        "Urgency: '7-Day Free Pro Trial — ends [date]. No card required.'",
        "Value: 'Get AI trade analysis, MT5 sync, and prop firm tracking — free for 7 days'",
        "Scarcity: 'Only [X] trial spots left this month'",
        "Retargeting: 'Your free trial is waiting. 3 days left to claim it.'",
      ],
      phases: [
        { name: "Pre-Launch (Days 1-2)", budget: "$10/day", goal: "Warm up pixel, test creatives" },
        { name: "Launch (Days 3-9)", budget: "$15/day", goal: "Drive trial signups, maximum spend on winners" },
        { name: "Trial Nurture (Days 10-21)", budget: "$8/day", goal: "Retarget trial users, push conversion to paid" },
      ],
      kpis: {
        targetTrialSignups: "100+ free trial activations",
        targetConversion: "20-30% trial to paid",
        targetCPA: "$2-4 per trial signup",
      },
    },
  ];
}

export async function repurposeContent(
  originalContent: MarketingContent,
  targetTypes: string[],
  brandSettings?: MarketingBrandSettings
): Promise<Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string }>> {
  const brandPrompt = buildBrandSystemPrompt(brandSettings);
  const results: Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string }> = [];

  for (const targetType of targetTypes) {
    const platformMap: Record<string, string> = {
      post: "instagram",
      reel_script: "instagram",
      ad_copy: "meta_ads",
      blog: "blog",
      email: "email",
    };

    const targetPlatform = platformMap[targetType] || "instagram";

    const prompt = `You are repurposing existing marketing content into a new format.

ORIGINAL CONTENT:
Type: ${originalContent.type}
Platform: ${originalContent.platform}
Title: ${originalContent.title || "Untitled"}
Content: ${originalContent.content}
${originalContent.hook ? `Hook: ${originalContent.hook}` : ""}
${originalContent.cta ? `CTA: ${originalContent.cta}` : ""}

TASK: Transform this into a ${targetType.replace("_", " ")} for ${targetPlatform}.
Keep the core message but adapt the format, tone, and length appropriately.

Return JSON:
{
  "title": "string",
  "content": "string (the main body)",
  "hook": "string (attention-grabbing opener, if applicable)",
  "cta": "string (call to action, if applicable)",
  "hashtags": "string (if social media)"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: brandPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      trackAIUsage({
        userId: "admin",
        model: MODEL,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        costUsd: calculateCost(MODEL, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
        feature: "repurpose_content",
      });

      results.push({
        type: targetType,
        platform: targetPlatform,
        title: parsed.title || `Repurposed: ${originalContent.title || targetType}`,
        content: parsed.content || "",
        hook: parsed.hook,
        cta: parsed.cta,
        hashtags: parsed.hashtags,
      });
    } catch (err) {
      console.error(`Failed to repurpose to ${targetType}:`, err);
    }
  }

  return results;
}

export async function generateSmartSuggestions(
  topContent: MarketingContent[],
  brandSettings?: MarketingBrandSettings
): Promise<Array<{ title: string; description: string; type: string; platform: string; topic: string }>> {
  if (topContent.length === 0) {
    return [
      { title: "Get Started", description: "Generate your first piece of content and rate it to unlock AI-powered suggestions.", type: "post", platform: "instagram", topic: "Getting started with Tradify" },
    ];
  }

  const brandPrompt = buildBrandSystemPrompt(brandSettings);
  const contentSummary = topContent.map(c => {
    return `- [${c.type}/${c.platform}] "${c.title || "Untitled"}" (Rating: ${c.performanceRating}/5) — Hook: "${c.hook || "N/A"}" — Content preview: "${c.content.substring(0, 150)}..."`;
  }).join("\n");

  const prompt = `Analyze these top-performing marketing content pieces and suggest 3 NEW content ideas that follow similar patterns:

TOP PERFORMERS:
${contentSummary}

Based on the patterns you see (hooks, topics, tone, platforms), generate 3 fresh content ideas.

Return JSON:
{
  "suggestions": [
    {
      "title": "Brief title for the content idea",
      "description": "2-3 sentence explanation of why this would work and what angle to take",
      "type": "post|reel_script|blog|email|ad_copy",
      "platform": "instagram|facebook|linkedin|twitter|tiktok|email",
      "hook": "A compelling opening hook for this content",
      "reasoning": "Brief explanation of which top performer pattern this is inspired by"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: brandPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    trackAIUsage({
      userId: "admin",
      model: MODEL,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      costUsd: calculateCost(MODEL, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
      feature: "smart_suggestions",
    });

    return parsed.suggestions || [];
  } catch (err) {
    console.error("Smart suggestions error:", err);
    return [];
  }
}

export async function generateFillWeekContent(
  brandSettings?: MarketingBrandSettings
): Promise<Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string; dayOffset: number }>> {
  const schedule = [
    { type: "post", platform: "instagram", dayOffset: 0 },
    { type: "reel_script", platform: "instagram", dayOffset: 1 },
    { type: "post", platform: "linkedin", dayOffset: 2 },
    { type: "blog", platform: "blog", dayOffset: 3 },
    { type: "email", platform: "email", dayOffset: 4 },
    { type: "post", platform: "facebook", dayOffset: 5 },
    { type: "post", platform: "twitter", dayOffset: 6 },
  ];

  const results: Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string; dayOffset: number }> = [];
  const brandPrompt = buildBrandSystemPrompt(brandSettings);
  const dataInsights = await getDataInsights();

  for (const item of schedule) {
    const prompt = `Generate a ${item.type.replace("_", " ")} for ${item.platform}.

${dataInsights}

Requirements:
- Make it unique and engaging
- Follow platform best practices for ${item.platform}
- Include a strong hook and clear CTA
${item.type === "blog" ? "- Write 800-1200 words with SEO optimization" : ""}
${item.type === "email" ? "- Include subject line and body" : ""}
${item.type === "reel_script" ? "- Include hook, problem, solution, CTA, and visual directions" : ""}

Return JSON:
{
  "title": "string",
  "content": "string (main body text)",
  "hook": "string (attention grabber)",
  "cta": "string (call to action)",
  "hashtags": "string (for social posts, empty for email/blog)"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: brandPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      trackAIUsage({
        userId: "admin",
        model: MODEL,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        costUsd: calculateCost(MODEL, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
        feature: "fill_week",
      });

      results.push({
        type: item.type,
        platform: item.platform,
        title: parsed.title || `${item.type} for ${item.platform}`,
        content: parsed.content || "",
        hook: parsed.hook,
        cta: parsed.cta,
        hashtags: parsed.hashtags,
        dayOffset: item.dayOffset,
      });
    } catch (err) {
      console.error(`Fill week generation failed for ${item.type}/${item.platform}:`, err);
    }
  }

  return results;
}

export async function generatePipelineContent(
  pipelineItems: Array<{ type: string; platform: string; count: number }>,
  brandSettings?: MarketingBrandSettings
): Promise<Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string; dayOffset: number }>> {
  const schedule: Array<{ type: string; platform: string; dayOffset: number }> = [];
  let dayOffset = 0;

  for (const item of pipelineItems) {
    for (let i = 0; i < item.count; i++) {
      schedule.push({ type: item.type, platform: item.platform, dayOffset: dayOffset % 7 });
      dayOffset++;
    }
  }

  const results: Array<{ type: string; platform: string; title: string; content: string; hook?: string; cta?: string; hashtags?: string; dayOffset: number }> = [];
  const brandPrompt = buildBrandSystemPrompt(brandSettings);
  const dataInsights = await getDataInsights();

  for (const item of schedule) {
    const prompt = `Generate a ${item.type.replace("_", " ")} for ${item.platform}.

${dataInsights}

Requirements:
- Make it unique and engaging
- Follow platform best practices for ${item.platform}
- Include a strong hook and clear CTA
${item.type === "blog" ? "- Write 800-1200 words with SEO optimization" : ""}
${item.type === "email" ? "- Include subject line and body" : ""}
${item.type === "reel_script" ? "- Include hook, problem, solution, CTA, and visual directions" : ""}

Return JSON:
{
  "title": "string",
  "content": "string (main body text)",
  "hook": "string (attention grabber)",
  "cta": "string (call to action)",
  "hashtags": "string (for social posts, empty for email/blog)"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: brandPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const raw = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      trackAIUsage({
        userId: "admin",
        model: MODEL,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        costUsd: calculateCost(MODEL, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
        feature: "pipeline",
      });

      results.push({
        type: item.type,
        platform: item.platform,
        title: parsed.title || `${item.type} for ${item.platform}`,
        content: parsed.content || "",
        hook: parsed.hook,
        cta: parsed.cta,
        hashtags: parsed.hashtags,
        dayOffset: item.dayOffset,
      });
    } catch (err) {
      console.error(`Pipeline generation failed for ${item.type}/${item.platform}:`, err);
    }
  }

  return results;
}
