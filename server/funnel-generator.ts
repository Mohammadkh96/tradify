import { storage } from "./storage";
import { generateImageBuffer } from "./replit_integrations/image/client";
import { generatePost, generateReelScript, generateAdCopy, generateBlogArticle, generateEmailCampaign } from "./marketing-ai";
import { trackAIUsage, calculateCost } from "./ai-cost-tracker";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL = "gpt-4o-mini";
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

export interface FunnelStage {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  goal: string;
  strategy: string;
  tone: string;
  color: string;
  assetTypes: { id: string; label: string; icon: string; description: string }[];
}

export const FUNNEL_STAGES: FunnelStage[] = [
  {
    id: "awareness",
    label: "TOFU — Awareness",
    shortLabel: "Awareness",
    description: "Prospects discover your brand through ads, SEO, or social media",
    goal: "Cast a wide net. Attract new audiences who don't know Tradify yet.",
    strategy: "Eye-catching, scroll-stopping content that introduces the brand. Use hooks, surprising stats, emotional trading pain points.",
    tone: "Inspiring, curious, bold, attention-grabbing",
    color: "emerald",
    assetTypes: [
      { id: "ad_image", label: "Ad Creative Image", icon: "Image", description: "Bold, attention-grabbing visual ads" },
      { id: "social_post", label: "Social Media Post", icon: "MessageSquare", description: "Educational tips, pain point hooks" },
      { id: "reel_script", label: "Reel Script", icon: "Video", description: "Hook → Problem → Solution scripts" },
      { id: "ad_copy", label: "Ad Copy Variations", icon: "FileText", description: "AIDA/PAS framework ad text" },
      { id: "landing_page", label: "Landing Page", icon: "Globe", description: "Waitlist/signup capture page" },
    ],
  },
  {
    id: "consideration",
    label: "MOFU — Consideration",
    shortLabel: "Consideration",
    description: "Prospects research and evaluate Tradify vs alternatives",
    goal: "Educate and nurture leads. Prove expertise and differentiation.",
    strategy: "Value-driven educational content. Feature highlights, comparisons, how-tos, social proof with data.",
    tone: "Authoritative, helpful, trustworthy, educational",
    color: "blue",
    assetTypes: [
      { id: "blog_article", label: "Blog Article", icon: "BookOpen", description: "SEO-optimized long-form content" },
      { id: "email_campaign", label: "Email Sequence", icon: "Mail", description: "Nurture drip campaigns" },
      { id: "comparison_post", label: "Comparison Post", icon: "GitCompare", description: "Tradify vs alternatives" },
      { id: "ad_image", label: "Feature Showcase Image", icon: "Image", description: "Platform features in action" },
      { id: "social_post", label: "Educational Post", icon: "MessageSquare", description: "Trading tips & insights" },
    ],
  },
  {
    id: "decision",
    label: "BOFU — Decision",
    shortLabel: "Decision",
    description: "Qualified leads are ready to purchase. Remove final objections.",
    goal: "Convince and convert. Use social proof, urgency, and strong CTAs.",
    strategy: "Testimonial-driven, urgency-based content. Before/after results, ROI calculations, limited-time offers.",
    tone: "Confident, urgent, persuasive, direct",
    color: "amber",
    assetTypes: [
      { id: "testimonial_post", label: "Testimonial Post", icon: "Quote", description: "User success stories" },
      { id: "ad_image", label: "Urgency Ad Image", icon: "Image", description: "Limited-time offer visuals" },
      { id: "case_study", label: "Case Study Post", icon: "TrendingUp", description: "Before/after performance" },
      { id: "landing_page", label: "Conversion Landing Page", icon: "Globe", description: "High-converting signup page" },
      { id: "reel_script", label: "Results Reel Script", icon: "Video", description: "Quick results showcase script" },
    ],
  },
  {
    id: "action",
    label: "Action — Conversion",
    shortLabel: "Conversion",
    description: "Drive the purchase. Simplify the path to becoming a customer.",
    goal: "Convert prospects into paying customers with clear, simple messaging.",
    strategy: "Clear CTAs, simplified messaging, feature unlocks, celebration of the decision.",
    tone: "Welcoming, celebratory, clear, action-oriented",
    color: "purple",
    assetTypes: [
      { id: "email_campaign", label: "Onboarding Email", icon: "Mail", description: "Welcome sequences for new subscribers" },
      { id: "landing_page", label: "Thank You Page", icon: "Globe", description: "Post-purchase confirmation" },
      { id: "social_post", label: "Feature Announcement", icon: "MessageSquare", description: "Premium feature highlights" },
      { id: "ad_image", label: "Retargeting Ad Image", icon: "Image", description: "For visitors who didn't convert" },
      { id: "ad_copy", label: "Retargeting Ad Copy", icon: "FileText", description: "Win-back messaging" },
    ],
  },
  {
    id: "loyalty",
    label: "Loyalty — Advocacy",
    shortLabel: "Advocacy",
    description: "Existing customers become repeat buyers and brand advocates.",
    goal: "Retain users, encourage upgrades, and turn customers into advocates.",
    strategy: "Gratitude, community highlights, exclusive perks, user achievements, referral incentives.",
    tone: "Warm, appreciative, exclusive, community-driven",
    color: "pink",
    assetTypes: [
      { id: "email_campaign", label: "Re-engagement Email", icon: "Mail", description: "Win back inactive users" },
      { id: "social_post", label: "Community Highlight", icon: "MessageSquare", description: "Celebrate user achievements" },
      { id: "ad_image", label: "Upsell Ad Image", icon: "Image", description: "Free→Pro or Pro→Elite upgrade" },
      { id: "testimonial_post", label: "Referral Post", icon: "Quote", description: "Encourage sharing & referrals" },
      { id: "ad_copy", label: "Upsell Ad Copy", icon: "FileText", description: "Upgrade messaging" },
    ],
  },
];

export interface GeneratedAsset {
  id: string;
  type: string;
  stage: string;
  platform: string;
  content?: string;
  fileUrl?: string;
  htmlContent?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  metadata?: Record<string, any>;
  generatedAt: string;
}

interface GenerateOptions {
  stage: string;
  assetTypes: string[];
  topic?: string;
  platform?: string;
  imageStyle?: string;
  videoDuration?: number;
}

function uid(): string {
  return crypto.randomBytes(8).toString("hex");
}

function getStageConfig(stageId: string): FunnelStage | undefined {
  return FUNNEL_STAGES.find(s => s.id === stageId);
}

function buildFunnelImagePrompt(stage: FunnelStage, topic: string | undefined, imageStyle: string): string {
  const brandColors = "dark background (#0a0a0a), emerald green (#10b981) accents, clean modern typography";

  const stagePrompts: Record<string, string> = {
    awareness: `Create a bold, eye-catching social media ad for a trading journal app called "Tradify". Style: ${imageStyle}. The image should STOP scrollers and grab attention. ${topic ? `Focus on: ${topic}.` : "Show the pain of unorganized trading."} Use ${brandColors}. Include visual elements that suggest trading/finance (charts, candlesticks, profit). Make it feel premium and professional. NO text in the image - just powerful visuals.`,
    consideration: `Create a professional, feature-focused marketing image for "Tradify" trading journal app. Style: ${imageStyle}. Show the platform's value and capabilities. ${topic ? `Focus on: ${topic}.` : "Highlight analytics and data-driven insights."} Use ${brandColors}. Show dashboard elements, charts, or data visualization that demonstrate the platform's power. Make it feel trustworthy and authoritative. NO text in the image.`,
    decision: `Create an urgency-driven, high-converting ad image for "Tradify" trading journal app. Style: ${imageStyle}. The image should create FOMO and desire to act NOW. ${topic ? `Focus on: ${topic}.` : "Show trading success and results."} Use ${brandColors} with amber/gold highlights for urgency. Show success metrics, profit charts, or before/after improvement. Make it feel exclusive and time-sensitive. NO text in the image.`,
    action: `Create a warm, welcoming marketing image for "Tradify" trading journal app targeting users who are about to sign up. Style: ${imageStyle}. ${topic ? `Focus on: ${topic}.` : "Show the excitement of getting started."} Use ${brandColors} with purple accents. Show a clean, inviting platform interface or celebration of joining. Make it feel like the start of something great. NO text in the image.`,
    loyalty: `Create a community-focused, appreciative marketing image for "Tradify" trading journal app targeting existing users. Style: ${imageStyle}. ${topic ? `Focus on: ${topic}.` : "Celebrate the trading community and user achievements."} Use ${brandColors} with pink/rose accents. Show achievement, growth, community connection. Make it feel exclusive and rewarding. NO text in the image.`,
  };

  return stagePrompts[stage.id] || stagePrompts.awareness;
}

async function callFunnelOpenAI(systemPrompt: string, userPrompt: string, feature: string): Promise<string> {
  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 3000,
  });
  const duration = Date.now() - startTime;

  const usage = response.usage;
  trackAIUsage({
    userId: "admin",
    userTier: "ADMIN",
    feature,
    model: MODEL,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    costUsd: calculateCost(MODEL, usage?.prompt_tokens ?? 0, usage?.completion_tokens ?? 0),
    requestDuration: duration,
  }).catch(err => console.error("[AI Cost Tracker] funnel_content error:", err));

  return response.choices[0]?.message?.content || "";
}

async function buildBrandContext(): Promise<string> {
  const brand = await storage.getMarketingBrandSettings("admin");
  if (!brand) {
    return `You are a marketing content creator for Tradify — a trading journal and analytics platform for forex, indices, and commodities traders. Tradify helps traders track trades, maintain discipline, and improve performance through data-driven insights.
Brand Voice: Professional yet approachable, confident but not arrogant, educational and empowering.
Target Audience: Retail forex/CFD traders, prop firm traders, and aspiring traders who want to improve their performance.
Key USPs: AI-powered trade analytics, MT5 bridge integration, prop firm challenge tracker, rule-based compliance engine, community traders hub.`;
  }
  const personas = Array.isArray(brand.targetAudiencePersonas) ? brand.targetAudiencePersonas : [];
  const usps = Array.isArray(brand.uniqueSellingPoints) ? brand.uniqueSellingPoints : [];
  const competitors = Array.isArray(brand.competitors) ? brand.competitors : [];
  const keyMessages = Array.isArray(brand.keyMessages) ? brand.keyMessages : [];
  return `You are a marketing content creator for ${brand.brandName}.
${brand.description ? `Description: ${brand.description}` : ""}
${brand.brandVoice ? `Brand Voice: ${brand.brandVoice}` : ""}
${brand.brandTone ? `Brand Tone: ${brand.brandTone}` : ""}
${personas.length > 0 ? `Target Audience: ${JSON.stringify(personas)}` : ""}
${usps.length > 0 ? `USPs: ${JSON.stringify(usps)}` : ""}
${competitors.length > 0 ? `Competitors: ${JSON.stringify(competitors)}` : ""}
${keyMessages.length > 0 ? `Key Messages: ${JSON.stringify(keyMessages)}` : ""}`;
}

async function generateAdImage(stage: FunnelStage, topic: string | undefined, imageStyle: string): Promise<GeneratedAsset> {
  const prompt = buildFunnelImagePrompt(stage, topic, imageStyle);
  const buffer = await generateImageBuffer(prompt, "1024x1024");
  const fileName = `${stage.id}-ad-${uid()}.png`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  trackAIUsage({
    userId: "admin",
    userTier: "ADMIN",
    feature: "funnel_image",
    model: "gpt-image-1",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 1,
    costUsd: calculateCost("gpt-image-1", 0, 0),
    requestDuration: 0,
  }).catch(err => console.error("[AI Cost Tracker] funnel_image error:", err));

  return {
    id: uid(),
    type: "ad_image",
    stage: stage.id,
    platform: "all",
    fileUrl: `/api/admin/marketing/funnel/file/${fileName}`,
    fileName,
    mimeType: "image/png",
    title: `${stage.shortLabel} Ad Creative`,
    generatedAt: new Date().toISOString(),
  };
}

async function generateSocialPostAsset(stage: FunnelStage, topic: string | undefined, platform: string): Promise<GeneratedAsset> {
  const contentTypeMap: Record<string, string> = {
    awareness: "educational tip",
    consideration: "feature highlight",
    decision: "testimonial",
    action: "promotional",
    loyalty: "behind the scenes",
  };
  const result = await generatePost(platform, contentTypeMap[stage.id] || "educational tip", topic);
  return {
    id: uid(),
    type: "social_post",
    stage: stage.id,
    platform,
    content: result.content || result.caption,
    title: result.hook || "Social Post",
    metadata: {
      caption: result.caption,
      hashtags: result.hashtags,
      hook: result.hook,
      cta: result.cta,
      bestPostingTime: result.bestPostingTime,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function generateReelScriptAsset(stage: FunnelStage, topic: string | undefined): Promise<GeneratedAsset> {
  const goalMap: Record<string, string> = {
    awareness: "brand awareness and reach",
    consideration: "education and trust building",
    decision: "social proof and urgency",
    action: "signups and conversions",
    loyalty: "community engagement and retention",
  };
  const result = await generateReelScript(goalMap[stage.id] || "awareness", topic);
  return {
    id: uid(),
    type: "reel_script",
    stage: stage.id,
    platform: "tiktok",
    content: result.fullScript || JSON.stringify(result, null, 2),
    title: result.hook || "Reel Script",
    metadata: {
      hook: result.hook,
      problem: result.problem,
      solution: result.solution,
      cta: result.cta,
      visualDirections: result.visualDirections,
      hookVariations: result.hookVariations,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function generateAdCopyAsset(stage: FunnelStage, topic: string | undefined, platform: string): Promise<GeneratedAsset> {
  const goalMap: Record<string, string> = {
    awareness: "brand awareness",
    consideration: "consideration and education",
    decision: "conversions",
    action: "signups",
    loyalty: "upsells and retention",
  };
  const audienceMap: Record<string, string> = {
    awareness: "cold audience, new prospects who never heard of Tradify",
    consideration: "warm audience, people researching trading journal solutions",
    decision: "hot audience, people comparing and ready to buy",
    action: "retargeting audience, website visitors who haven't signed up",
    loyalty: "existing users, current free or paid subscribers",
  };
  const result = await generateAdCopy(goalMap[stage.id] || "awareness", audienceMap[stage.id] || "cold audience");
  return {
    id: uid(),
    type: "ad_copy",
    stage: stage.id,
    platform,
    content: JSON.stringify(result, null, 2),
    title: "Ad Copy Variations",
    metadata: result,
    generatedAt: new Date().toISOString(),
  };
}

async function generateBlogArticleAsset(stage: FunnelStage, topic: string | undefined): Promise<GeneratedAsset> {
  const topicMap: Record<string, string> = {
    awareness: topic || "Why every trader needs a trading journal to succeed",
    consideration: topic || "How Tradify compares to spreadsheet trading journals",
    decision: topic || "How traders improved their win rate by 30% using Tradify",
    action: topic || "Getting started with Tradify: Your first week guide",
    loyalty: topic || "Advanced Tradify features you might be missing",
  };
  const result = await generateBlogArticle(topicMap[stage.id], undefined);
  return {
    id: uid(),
    type: "blog_article",
    stage: stage.id,
    platform: "blog",
    content: result.content,
    title: result.title || "Blog Article",
    metadata: {
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      hook: result.hook,
      cta: result.cta,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function generateEmailCampaignAsset(stage: FunnelStage, topic: string | undefined): Promise<GeneratedAsset> {
  const emailTypeMap: Record<string, string> = {
    awareness: "welcome",
    consideration: "feature_announcement",
    decision: "promotional",
    action: "welcome",
    loyalty: "re_engagement",
  };
  const segmentMap: Record<string, string> = {
    awareness: "free",
    consideration: "free",
    decision: "free",
    action: "pro",
    loyalty: "inactive",
  };
  const result = await generateEmailCampaign(emailTypeMap[stage.id] || "welcome", segmentMap[stage.id] || "free");
  return {
    id: uid(),
    type: "email_campaign",
    stage: stage.id,
    platform: "email",
    content: result.body,
    title: result.subjectLine || "Email Campaign",
    metadata: {
      subjectLine: result.subjectLine,
      preheader: result.preheader,
      cta: result.cta,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function generateLandingPageAsset(stage: FunnelStage, topic: string | undefined): Promise<GeneratedAsset> {
  const brandContext = await buildBrandContext();
  const pageTypeMap: Record<string, string> = {
    awareness: "a waitlist/early access capture page. Goal: collect email addresses from curious traders. Include a compelling headline about trading discipline, a brief value proposition, an email signup form, and social proof (e.g., '500+ traders already signed up').",
    consideration: "an educational landing page. Goal: showcase Tradify's features and benefits. Include feature cards, comparison section, testimonials area, and a 'Start Free Trial' CTA.",
    decision: "a high-converting pricing/signup page. Goal: drive immediate signups. Include pricing tiers (Free/Pro/Elite), feature comparison table, urgency element (limited founding member spots), testimonials, and a prominent CTA.",
    action: "a thank-you/welcome page. Goal: onboard new users. Include a welcome message, quick-start steps (3 steps to get started), links to key features, and a celebration element.",
    loyalty: "a referral/upgrade page. Goal: encourage existing users to refer friends or upgrade. Include referral benefits, upgrade comparison, user achievements showcase, and community stats.",
  };

  const systemPrompt = `${brandContext}

You are an expert landing page designer. Generate a COMPLETE, self-contained HTML page that works standalone.
Use this color scheme: background #0a0a0a, text white, accent emerald (#10b981), cards #1a1a1a, borders #2a2a2a.
The page must be responsive, modern, and high-converting.
Include all CSS inline in a <style> tag. Do NOT use external resources.
Make it look premium and professional — like a fintech/SaaS product.`;

  const userPrompt = `Create ${pageTypeMap[stage.id] || pageTypeMap.awareness}
${topic ? `Theme/Focus: ${topic}` : ""}
Brand name: Tradify
Return ONLY the complete HTML code, starting with <!DOCTYPE html>.`;

  const html = await callFunnelOpenAI(systemPrompt, userPrompt, "funnel_landing_page");
  const cleanHtml = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

  const fileName = `${stage.id}-landing-${uid()}.html`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, cleanHtml, "utf-8");

  return {
    id: uid(),
    type: "landing_page",
    stage: stage.id,
    platform: "web",
    htmlContent: cleanHtml,
    fileUrl: `/api/admin/marketing/funnel/file/${fileName}`,
    fileName,
    mimeType: "text/html",
    title: `${stage.shortLabel} Landing Page`,
    generatedAt: new Date().toISOString(),
  };
}

async function generateComparisonPost(stage: FunnelStage, topic: string | undefined, platform: string): Promise<GeneratedAsset> {
  const brandContext = await buildBrandContext();
  const systemPrompt = `${brandContext}

You create comparison-style social media posts that position the brand as the clear winner.
Funnel Stage: ${stage.label} — ${stage.goal}
Tone: ${stage.tone}`;

  const userPrompt = `Create a comparison post for ${platform}.
${topic ? `Focus: ${topic}` : "Compare Tradify to using spreadsheets or no journal at all."}

Format your response as JSON:
{
  "caption": "full post caption with emojis and formatting",
  "hook": "attention-grabbing first line",
  "hashtags": "relevant hashtags",
  "comparisonPoints": ["point 1", "point 2", "point 3"]
}`;

  const raw = await callFunnelOpenAI(systemPrompt, userPrompt, "funnel_comparison");
  let parsed: any = {};
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = { caption: raw }; }

  return {
    id: uid(),
    type: "comparison_post",
    stage: stage.id,
    platform,
    content: parsed.caption || raw,
    title: parsed.hook || "Comparison Post",
    metadata: parsed,
    generatedAt: new Date().toISOString(),
  };
}

async function generateTestimonialPost(stage: FunnelStage, topic: string | undefined, platform: string): Promise<GeneratedAsset> {
  const brandContext = await buildBrandContext();
  const systemPrompt = `${brandContext}

You create realistic, compelling testimonial-style social media posts.
Funnel Stage: ${stage.label} — ${stage.goal}
Tone: ${stage.tone}
Create content that feels authentic — like a real user sharing their experience.`;

  const userPrompt = `Create a testimonial-style post for ${platform}.
${topic ? `Focus: ${topic}` : "A trader who improved their results using Tradify."}

Format your response as JSON:
{
  "caption": "full post with the testimonial story, emojis, and formatting",
  "hook": "attention-grabbing opening",
  "traderName": "realistic first name",
  "resultHighlight": "key metric (e.g., '32% win rate improvement in 3 months')",
  "hashtags": "relevant hashtags"
}`;

  const raw = await callFunnelOpenAI(systemPrompt, userPrompt, "funnel_testimonial");
  let parsed: any = {};
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = { caption: raw }; }

  return {
    id: uid(),
    type: "testimonial_post",
    stage: stage.id,
    platform,
    content: parsed.caption || raw,
    title: parsed.hook || "Testimonial Post",
    metadata: parsed,
    generatedAt: new Date().toISOString(),
  };
}

async function generateCaseStudy(stage: FunnelStage, topic: string | undefined): Promise<GeneratedAsset> {
  const brandContext = await buildBrandContext();
  const systemPrompt = `${brandContext}

You create compelling case study content showing before/after trading performance.
Funnel Stage: ${stage.label} — ${stage.goal}
Tone: ${stage.tone}`;

  const userPrompt = `Create a case study post.
${topic ? `Focus: ${topic}` : "A trader who went from inconsistent results to profitable trading using Tradify."}

Format your response as JSON:
{
  "title": "case study title",
  "hook": "compelling opening line",
  "beforeMetrics": { "winRate": "42%", "avgRR": "0.8:1", "monthlyReturn": "-3%" },
  "afterMetrics": { "winRate": "67%", "avgRR": "2.1:1", "monthlyReturn": "+8%" },
  "story": "the full narrative (3-4 paragraphs)",
  "keyTakeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "cta": "call to action"
}`;

  const raw = await callFunnelOpenAI(systemPrompt, userPrompt, "funnel_case_study");
  let parsed: any = {};
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch { parsed = { story: raw }; }

  return {
    id: uid(),
    type: "case_study",
    stage: stage.id,
    platform: "blog",
    content: parsed.story || raw,
    title: parsed.title || "Case Study",
    metadata: parsed,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateFunnelAssets(options: GenerateOptions): Promise<GeneratedAsset[]> {
  const stage = getStageConfig(options.stage);
  if (!stage) throw new Error(`Unknown funnel stage: ${options.stage}`);

  const platform = options.platform || "instagram";
  const imageStyle = options.imageStyle || "Professional";
  const assets: GeneratedAsset[] = [];

  for (const assetType of options.assetTypes) {
    try {
      let asset: GeneratedAsset;
      switch (assetType) {
        case "ad_image":
          asset = await generateAdImage(stage, options.topic, imageStyle);
          break;
        case "social_post":
          asset = await generateSocialPostAsset(stage, options.topic, platform);
          break;
        case "reel_script":
          asset = await generateReelScriptAsset(stage, options.topic);
          break;
        case "ad_copy":
          asset = await generateAdCopyAsset(stage, options.topic, platform);
          break;
        case "blog_article":
          asset = await generateBlogArticleAsset(stage, options.topic);
          break;
        case "email_campaign":
          asset = await generateEmailCampaignAsset(stage, options.topic);
          break;
        case "landing_page":
          asset = await generateLandingPageAsset(stage, options.topic);
          break;
        case "comparison_post":
          asset = await generateComparisonPost(stage, options.topic, platform);
          break;
        case "testimonial_post":
          asset = await generateTestimonialPost(stage, options.topic, platform);
          break;
        case "case_study":
          asset = await generateCaseStudy(stage, options.topic);
          break;
        default:
          console.warn(`Unknown asset type: ${assetType}`);
          continue;
      }
      assets.push(asset);
    } catch (err) {
      console.error(`Failed to generate ${assetType} for ${stage.id}:`, err);
      assets.push({
        id: uid(),
        type: assetType,
        stage: stage.id,
        platform,
        content: `Error generating ${assetType}: ${(err as Error).message}`,
        title: `Failed: ${assetType}`,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  return assets;
}

export async function generateSingleAsset(options: {
  type: string;
  stage: string;
  topic?: string;
  platform?: string;
  imageStyle?: string;
}): Promise<GeneratedAsset> {
  const result = await generateFunnelAssets({
    stage: options.stage,
    assetTypes: [options.type],
    topic: options.topic,
    platform: options.platform,
    imageStyle: options.imageStyle,
  });
  if (result.length === 0) throw new Error("No asset generated");
  return result[0];
}
