import { storage } from "./storage";
import { generateImageBuffer } from "./replit_integrations/image/client";
import { generatePost, generateReelScript, generateAdCopy, generateBlogArticle, generateEmailCampaign } from "./marketing-ai";
import { trackAIUsage, calculateCost } from "./ai-cost-tracker";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODEL = "gpt-4o-mini";
const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

function getFFmpegBin(): string {
  try {
    return execSync("which ffmpeg", { encoding: "utf-8" }).trim();
  } catch {
    return "ffmpeg";
  }
}
const ffmpegBin = getFFmpegBin();

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
      { id: "video_reel", label: "Video Reel (9:16)", icon: "Film", description: "Short video clip for Reels/TikTok" },
      { id: "stock_photo", label: "Stock Photo", icon: "Camera", description: "Professional trading/finance imagery" },
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
      { id: "stock_photo", label: "Stock Photo", icon: "Camera", description: "Professional analytics imagery" },
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
      { id: "video_reel", label: "Results Video Reel", icon: "Film", description: "Quick results/testimonial video" },
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
  aspectRatio?: string;
  photoOrientation?: string;
  photoStyle?: string;
}

function uid(): string {
  return crypto.randomBytes(8).toString("hex");
}

function getStageConfig(stageId: string): FunnelStage | undefined {
  return FUNNEL_STAGES.find(s => s.id === stageId);
}

const ASPECT_RATIO_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "9:16": "1024x1536",
  "16:9": "1536x1024",
  "4:5": "1024x1536",
};

function buildFunnelImagePrompt(stage: FunnelStage, topic: string | undefined, imageStyle: string, aspectRatio?: string): string {
  const brandSpec = `Color palette: jet black (#0a0a0a) background, emerald green (#10b981) as primary accent, white (#ffffff) for contrast elements. Typography feel: clean sans-serif, modern fintech aesthetic. Overall mood: premium, sleek, tech-forward.`;
  const compositionNote = aspectRatio === "9:16" ? "Vertical composition optimized for mobile Stories/Reels." : aspectRatio === "16:9" ? "Widescreen cinematic composition." : aspectRatio === "4:5" ? "Tall portrait composition optimized for Instagram/Facebook feed posts (4:5 ratio)." : "Square composition optimized for social feed posts.";
  const negativePrompt = "Absolutely NO text, NO letters, NO words, NO watermarks, NO logos, NO signatures, NO blurry areas, NO distorted elements.";

  const stagePrompts: Record<string, string> = {
    awareness: `Create a scroll-stopping, high-impact social media ad visual for a premium trading journal & analytics platform. Style: ${imageStyle}. ${compositionNote} ${topic ? `Theme: ${topic}.` : "Theme: the chaos and frustration of unorganized trading vs. the promise of clarity."} Visual direction: dramatic cinematic lighting with volumetric light rays, glowing emerald accent highlights cutting through darkness, financial data visualizations (candlestick charts, equity curves) rendered as beautiful abstract art. Depth: foreground elements sharp, background with cinematic bokeh. ${brandSpec} ${negativePrompt}`,
    consideration: `Create a sophisticated, trust-building marketing visual for a premium trading analytics platform. Style: ${imageStyle}. ${compositionNote} ${topic ? `Theme: ${topic}.` : "Theme: the power of data-driven trading decisions and professional analytics."} Visual direction: clean, organized dashboard interface elements floating in 3D space, data visualization graphics (heat maps, performance charts, win-rate gauges) rendered beautifully, professional studio lighting with soft key light and rim light separation. Convey authority and intelligence. ${brandSpec} ${negativePrompt}`,
    decision: `Create a high-converting, urgency-driven ad visual for a premium trading platform's limited-time offer. Style: ${imageStyle}. ${compositionNote} ${topic ? `Theme: ${topic}.` : "Theme: trading success, breakthrough results, and the urgency to act now."} Visual direction: dramatic golden/amber highlights mixed with emerald on dark background, visual metaphors for success (upward arrows, growth charts, unlocked premium features), lens flare and volumetric lighting creating urgency and excitement. Premium and exclusive feeling. ${brandSpec} Add warm amber (#f59e0b) and gold accents for urgency. ${negativePrompt}`,
    action: `Create a warm, celebratory marketing visual for onboarding new users to a premium trading platform. Style: ${imageStyle}. ${compositionNote} ${topic ? `Theme: ${topic}.` : "Theme: the excitement of a fresh start and unlocking powerful tools."} Visual direction: welcoming composition with soft purple and emerald gradients, clean interface elements suggesting ease of use, subtle celebration particles (confetti, sparkles), inviting and accessible mood with professional polish. ${brandSpec} Add soft purple (#8b5cf6) accents. ${negativePrompt}`,
    loyalty: `Create a community-celebrating, appreciation-focused marketing visual for existing premium platform users. Style: ${imageStyle}. ${compositionNote} ${topic ? `Theme: ${topic}.` : "Theme: community achievement, growth milestones, and exclusive membership."} Visual direction: warm, inclusive composition with rose/pink and emerald harmony, visual metaphors for achievement (trophies, milestone markers, ascending paths), community connection feeling, premium exclusive club aesthetic with soft warm lighting. ${brandSpec} Add rose (#f43f5e) accents. ${negativePrompt}`,
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

async function generateAdImage(stage: FunnelStage, topic: string | undefined, imageStyle: string, aspectRatio: string = "1:1"): Promise<GeneratedAsset> {
  const prompt = buildFunnelImagePrompt(stage, topic, imageStyle, aspectRatio);
  const size = ASPECT_RATIO_SIZES[aspectRatio] || "1024x1024";
  const buffer = await generateImageBuffer(prompt, size);
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

  const ratioLabel = aspectRatio === "1:1" ? "Square" : aspectRatio === "9:16" ? "Story" : aspectRatio === "16:9" ? "Landscape" : "Post";
  return {
    id: uid(),
    type: "ad_image",
    stage: stage.id,
    platform: "all",
    fileUrl: `/api/admin/marketing/funnel/file/${fileName}`,
    fileName,
    mimeType: "image/png",
    title: `${stage.shortLabel} Ad Creative (${ratioLabel})`,
    metadata: { aspectRatio, size },
    generatedAt: new Date().toISOString(),
  };
}

async function generateVideoReel(stage: FunnelStage, topic: string | undefined, imageStyle: string, platform: string, duration: number = 6): Promise<GeneratedAsset> {
  const brandSpec = "jet black (#0a0a0a) background, emerald (#10b981) accent glow, white highlights, premium fintech aesthetic";
  const neg = "NO text, NO letters, NO words, NO watermarks, NO logos.";
  const frameCount = Math.max(4, Math.ceil(duration / 1.5));
  const topicNote = topic ? `Content theme: ${topic}.` : "";

  const stageVideoPrompts: Record<string, string[]> = {
    awareness: [
      `Cinematic close-up of glowing green candlestick charts rising on a dark glass screen, volumetric emerald light rays cutting through darkness, shallow depth of field, anamorphic lens flare. ${brandSpec}. ${imageStyle} style. Vertical 9:16 portrait composition. ${neg}`,
      `Overhead shot of a frustrated trader's messy desk — scattered sticky notes, coffee rings, multiple browser tabs of spreadsheets, dim blue monitor glow, moody chiaroscuro lighting. ${topicNote} ${neg}`,
      `Sleek dark trading dashboard interface with emerald green data streams flowing across multiple panels, holographic 3D chart projection effect, futuristic premium feel, ray-traced reflections. ${brandSpec}. ${neg}`,
      `Abstract data flow visualization: glowing emerald particles forming an upward equity curve against pure black, cinematic depth, bokeh orbs in background. ${imageStyle} style. ${neg}`,
      `Wide-angle shot of a modern trading floor at night, rows of dark monitors with emerald data, ambient glow, dramatic vanishing point perspective. ${brandSpec}. ${neg}`,
      `Close-up of a hand touching a glass tablet showing a beautiful profit chart going up, emerald reflections on the hand, dark background, premium tech feel. ${neg}`,
    ],
    consideration: [
      `Professional multi-monitor trading setup in a modern office, clean organized desk, each screen showing different analytics dashboards with emerald data visualizations, soft rim lighting. ${brandSpec}. ${imageStyle} style. ${neg}`,
      `Split-screen concept: left side shows chaotic spreadsheet data in harsh blue light, right side shows elegant organized dashboard with emerald charts, visual contrast between old and new. ${topicNote} ${neg}`,
      `3D isometric view of a data analytics platform interface floating in dark space, heat maps and performance gauges glowing, professional studio lighting with soft shadows. ${brandSpec}. ${neg}`,
      `A focused professional analyzing a large performance chart on a curved ultrawide monitor, emerald data reflections on their face, soft bokeh background. ${topicNote} ${neg}`,
      `Beautiful infographic-style data visualization floating in dark 3D space: pie charts, bar graphs, win-rate dials all glowing emerald, connected by luminous data streams. ${neg}`,
    ],
    decision: [
      `Dramatic profit chart with exponential growth curve glowing in gold and emerald against pure black, volumetric light rays, lens flare at the peak, cinematic epic feeling. ${imageStyle} style. ${neg}`,
      `Confident trader in a premium modern office raising their fist in celebration, golden hour backlight mixing with emerald monitor glow, shallow DOF. ${topicNote} ${neg}`,
      `Luxurious premium membership card floating in dramatic spotlight, holographic emerald shimmer, dark reflective surface below, exclusive VIP aesthetic. ${brandSpec}. ${neg}`,
      `Before-and-after trading performance visualization: left dimmed red charts, right brilliant emerald green growth, dramatic transition effect in the middle. ${neg}`,
      `Close-up of a golden trophy with emerald accents on a dark reflective desk, surrounded by subtle bokeh lights, achievement and success mood. ${neg}`,
    ],
    action: [
      `A glowing emerald "Get Started" button on a dark glass surface, finger hovering above it, dramatic rim lighting, anticipation moment, premium tech UI feel. ${imageStyle} style. ${neg}`,
      `Welcome celebration scene: dark background with emerald and purple confetti particles falling in slow motion, spotlight effect, joyous premium feeling. ${topicNote} ${neg}`,
      `Trading dashboard powering on sequence — screens lighting up one by one with emerald data, futuristic boot-up visualization, dark environment. ${brandSpec}. ${neg}`,
      `Clean onboarding interface floating in 3D dark space with soft purple and emerald gradient glow, welcoming and modern, step indicators lit up. ${neg}`,
    ],
    loyalty: [
      `Glowing achievement trophy made of emerald crystal and gold, floating above a dark reflective surface, premium volumetric lighting, exclusive feel. ${imageStyle} style. ${neg}`,
      `Diverse group of professionals in a modern trading community space, warm amber lighting mixing with emerald accents, celebration mood, team achievement. ${topicNote} ${neg}`,
      `Long-term growth equity curve spanning years, consistent upward trend glowing emerald with milestone markers in gold, dark cinematic background. ${brandSpec}. ${neg}`,
      `Premium referral/community badge with holographic effects, emerald and rose gold colors, floating in dramatic spotlight, exclusive membership aesthetic. ${neg}`,
    ],
  };

  const prompts = stageVideoPrompts[stage.id] || stageVideoPrompts.awareness;
  const selectedPrompts = prompts.slice(0, frameCount);

  const frameBuffers: Buffer[] = [];
  for (const prompt of selectedPrompts) {
    const buffer = await generateImageBuffer(prompt, "1024x1536");
    frameBuffers.push(buffer);

    trackAIUsage({
      userId: "admin",
      userTier: "ADMIN",
      feature: "funnel_video_frame",
      model: "gpt-image-1",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 1,
      costUsd: calculateCost("gpt-image-1", 0, 0),
      requestDuration: 0,
    }).catch(err => console.error("[AI Cost Tracker] funnel_video_frame error:", err));
  }

  const videoId = uid();
  const tmpDir = path.join(GENERATED_DIR, `tmp-${videoId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  frameBuffers.forEach((buf, i) => {
    fs.writeFileSync(path.join(tmpDir, `frame-${String(i).padStart(3, "0")}.png`), buf);
  });

  const fileName = `${stage.id}-reel-${videoId}.mp4`;
  const outputPath = path.join(GENERATED_DIR, fileName);
  const fps = 25;
  const segDuration = Math.max(1.0, duration / frameCount);
  const segFrames = Math.max(fps, Math.round(segDuration * fps));

  try {
    const inputs = frameBuffers.map((_, i) => `-loop 1 -t ${segDuration} -i "${path.join(tmpDir, `frame-${String(i).padStart(3, "0")}.png`)}"`).join(" ");
    const xfadeDuration = Math.min(0.8, segDuration * 0.4);
    let filterChain = "";
    const totalStreams = frameBuffers.length;

    if (totalStreams >= 2) {
      let lastStream = "[0:v]";
      const parts: string[] = [];

      for (let i = 0; i < totalStreams; i++) {
        parts.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames}:s=1080x1920:fps=${fps},format=yuv420p[v${i}]`);
      }

      lastStream = "[v0]";
      for (let i = 1; i < totalStreams; i++) {
        const offset = (i * segDuration) - (i * xfadeDuration);
        const outLabel = i < totalStreams - 1 ? `[xf${i}]` : "[outv]";
        parts.push(`${lastStream}[v${i}]xfade=transition=fade:duration=${xfadeDuration.toFixed(2)}:offset=${offset.toFixed(2)}${outLabel}`);
        lastStream = outLabel;
      }

      filterChain = parts.join("; ");
    } else {
      filterChain = `[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames}:s=1080x1920:fps=${fps},format=yuv420p[outv]`;
    }

    execSync(
      `${ffmpegBin} -y ${inputs} -filter_complex "${filterChain}" -map "[outv]" -c:v libx264 -preset fast -crf 22 -t ${duration} "${outputPath}"`,
      { timeout: 180000, stdio: "pipe" }
    );
  } catch (xfadeErr) {
    console.error("FFmpeg xfade pipeline failed, trying simple concat:", (xfadeErr as Error).message);
    try {
      const concatFile = path.join(tmpDir, "concat.txt");
      const concatContent = frameBuffers.map((_, i) =>
        `file '${path.join(tmpDir, `frame-${String(i).padStart(3, "0")}.png`)}'\nduration ${segDuration}`
      ).join("\n") + `\nfile '${path.join(tmpDir, `frame-${String(frameBuffers.length - 1).padStart(3, "0")}.png`)}'`;
      fs.writeFileSync(concatFile, concatContent);

      execSync(
        `${ffmpegBin} -y -f concat -safe 0 -i "${concatFile}" ` +
        `-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `zoompan=z='min(zoom+0.001,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${segFrames}:s=1080x1920:fps=${fps},format=yuv420p" ` +
        `-c:v libx264 -preset fast -crf 22 -t ${duration} "${outputPath}"`,
        { timeout: 180000, stdio: "pipe" }
      );
    } catch (fallbackErr) {
      console.error("FFmpeg fallback also failed:", (fallbackErr as Error).message);
    }
  }

  try {
    fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
    fs.rmdirSync(tmpDir);
  } catch {}

  if (!fs.existsSync(outputPath)) {
    return {
      id: videoId,
      type: "video_reel",
      stage: stage.id,
      platform,
      content: "Video generation failed — frames were generated but ffmpeg encoding encountered an error.",
      title: `${stage.shortLabel} Video Reel (Failed)`,
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    id: videoId,
    type: "video_reel",
    stage: stage.id,
    platform,
    fileUrl: `/api/admin/marketing/funnel/file/${fileName}`,
    fileName,
    mimeType: "video/mp4",
    title: `${stage.shortLabel} Video Reel (${duration}s)`,
    metadata: {
      duration,
      frameCount,
      aspectRatio: "9:16",
      format: "MP4 (H.264)",
      transitions: "crossfade",
    },
    generatedAt: new Date().toISOString(),
  };
}

const ORIENTATION_SIZES: Record<string, string> = {
  portrait: "1024x1536",
  landscape: "1536x1024",
  square: "1024x1024",
};

const PHOTO_STYLE_MODIFIERS: Record<string, string> = {
  editorial: "Clean editorial style, minimal post-processing, natural color grade, magazine-quality composition with strong leading lines and rule-of-thirds framing.",
  lifestyle: "Warm lifestyle photography style, candid natural moment, soft golden color grade, authentic and relatable feeling, slightly desaturated shadows.",
  corporate: "Polished corporate photography, bright and clean, professional studio lighting with 3-point setup, sharp focus throughout, neutral modern color palette.",
  candid: "Candid documentary-style photography, natural unposed moment captured, available light, slight grain, authentic and raw, photojournalistic approach.",
};

async function generateStockPhoto(stage: FunnelStage, topic: string | undefined, orientation: string = "landscape", photoStyle: string = "editorial"): Promise<GeneratedAsset> {
  const styleModifier = PHOTO_STYLE_MODIFIERS[photoStyle] || PHOTO_STYLE_MODIFIERS.editorial;
  const cameraSpec = orientation === "portrait"
    ? "Shot on Sony A7IV with 85mm f/1.4 GM lens, vertical portrait orientation, shallow depth of field f/2.0, creamy bokeh."
    : orientation === "landscape"
    ? "Shot on Canon EOS R5 with 35mm f/1.4L lens, wide landscape orientation, deep focus f/5.6 for environmental context."
    : "Shot on Nikon Z8 with 50mm f/1.8 lens, square format, balanced composition.";

  const lightingSpec: Record<string, string> = {
    awareness: "Dramatic chiaroscuro lighting with strong directional key light, deep shadows, rim light separating subject from background. Moody and cinematic.",
    consideration: "Soft diffused window light from the side, fill card on opposite side reducing contrast ratio to 2:1, warm color temperature 4500K. Professional and approachable.",
    decision: "Golden hour backlighting creating a warm glow around the subject, fill flash at -2 stops for shadow detail, lens flare. Success and achievement mood.",
    action: "Clean bright studio lighting, large octabox key light at 45 degrees, white reflector fill, slight hair light for separation. Fresh and energetic.",
    loyalty: "Warm ambient lighting mixed with tungsten practicals, 3200K color temperature, soft shadows, intimate and celebratory mood. Candid warmth.",
  };

  const sceneDesc: Record<string, string> = {
    awareness: topic || "A focused trader concentrating on their screen in a dimly lit modern home office, multiple monitors showing financial data, the glow of charts illuminating their face, intense concentration",
    consideration: topic || "A data analyst in a bright modern workspace reviewing performance charts on a large curved monitor, clean organized desk with notebook and coffee, professional and methodical",
    decision: topic || "A confident financial professional in a premium office celebrating a milestone, genuine smile of achievement, modern minimalist surroundings with city skyline visible through floor-to-ceiling windows",
    action: topic || "Hands actively interacting with a sleek laptop showing a financial dashboard, modern clean desk setup, morning daylight streaming through windows, fresh start energy",
    loyalty: topic || "A diverse group of three professionals in a modern co-working space sharing ideas around a screen showing growth charts, genuine collaboration and team spirit, natural interaction",
  };

  const scene = sceneDesc[stage.id] || sceneDesc.awareness;
  const lighting = lightingSpec[stage.id] || lightingSpec.awareness;

  const prompt = `Ultra-realistic professional stock photograph. ${cameraSpec} ${lighting} Scene: ${scene}. ${styleModifier} Color science: natural skin tones, accurate white balance, subtle color grading. Technical quality: sharp focus on subject, natural motion blur where appropriate, professional post-production. Absolutely NO text, NO logos, NO watermarks, NO artificial elements, NO CGI.`;

  const size = ORIENTATION_SIZES[orientation] || "1536x1024";
  const buffer = await generateImageBuffer(prompt, size);
  const fileName = `${stage.id}-stock-${uid()}.png`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  trackAIUsage({
    userId: "admin",
    userTier: "ADMIN",
    feature: "funnel_stock_photo",
    model: "gpt-image-1",
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 1,
    costUsd: calculateCost("gpt-image-1", 0, 0),
    requestDuration: 0,
  }).catch(err => console.error("[AI Cost Tracker] funnel_stock error:", err));

  const orientLabel = orientation.charAt(0).toUpperCase() + orientation.slice(1);
  const styleLabel = photoStyle.charAt(0).toUpperCase() + photoStyle.slice(1);
  return {
    id: uid(),
    type: "stock_photo",
    stage: stage.id,
    platform: "all",
    fileUrl: `/api/admin/marketing/funnel/file/${fileName}`,
    fileName,
    mimeType: "image/png",
    title: `${stage.shortLabel} Stock Photo (${styleLabel}, ${orientLabel})`,
    metadata: { orientation, photoStyle, size },
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
    content: result.content || JSON.stringify(result, null, 2),
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
          asset = await generateAdImage(stage, options.topic, imageStyle, options.aspectRatio || "1:1");
          break;
        case "video_reel":
          asset = await generateVideoReel(stage, options.topic, imageStyle, platform, options.videoDuration || 6);
          break;
        case "stock_photo":
          asset = await generateStockPhoto(stage, options.topic, options.photoOrientation || "landscape", options.photoStyle || "editorial");
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
  videoDuration?: number;
  aspectRatio?: string;
  photoOrientation?: string;
  photoStyle?: string;
}): Promise<GeneratedAsset> {
  const result = await generateFunnelAssets({
    stage: options.stage,
    assetTypes: [options.type],
    topic: options.topic,
    platform: options.platform,
    imageStyle: options.imageStyle,
    videoDuration: options.videoDuration,
    aspectRatio: options.aspectRatio,
    photoOrientation: options.photoOrientation,
    photoStyle: options.photoStyle,
  });
  if (result.length === 0) throw new Error("No asset generated");
  return result[0];
}
