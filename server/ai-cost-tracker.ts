import { db } from "./db";
import { aiUsageLogs } from "@shared/schema";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  "gpt-4o": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-5.1": { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  "gpt-4o-mini-transcribe": { input: 0.003 / 60, output: 0 },
  "gpt-audio-mini": { input: 0.06 / 1_000_000, output: 0.24 / 1_000_000 },
};

const IMAGE_COST_PER_IMAGE = 0.04;
const AUDIO_TOKEN_COST = 0.001;

export function calculateCost(model: string, promptTokens: number, completionTokens: number): string {
  if (model === "gpt-image-1") {
    return IMAGE_COST_PER_IMAGE.toFixed(6);
  }

  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    const fallback = MODEL_PRICING["gpt-4o-mini"];
    const cost = promptTokens * fallback.input + completionTokens * fallback.output;
    return cost.toFixed(6);
  }

  if (model === "gpt-audio-mini") {
    const textCost = promptTokens * pricing.input + completionTokens * pricing.output;
    return textCost.toFixed(6);
  }

  const cost = promptTokens * pricing.input + completionTokens * pricing.output;
  return cost.toFixed(6);
}

export async function trackAIUsage(params: {
  userId: string;
  userTier: string;
  feature: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: string;
  requestDuration?: number;
}): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      userId: params.userId,
      userTier: params.userTier,
      feature: params.feature,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      costUsd: params.costUsd,
      requestDuration: params.requestDuration ?? null,
    });
  } catch (error) {
    console.error("[AI Cost Tracker] Failed to log usage:", error);
  }
}

export async function wrapOpenAICall<T>(
  openaiCall: () => Promise<T>,
  metadata: {
    userId: string;
    userTier: string;
    feature: string;
    model: string;
  }
): Promise<T> {
  const startTime = Date.now();
  const result = await openaiCall();
  const duration = Date.now() - startTime;

  const response = result as any;
  const usage = response?.usage;

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  if (usage) {
    promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0;
    completionTokens = usage.completion_tokens ?? usage.completionTokens ?? 0;
    totalTokens = usage.total_tokens ?? usage.totalTokens ?? (promptTokens + completionTokens);
  } else if (metadata.model === "gpt-image-1") {
    totalTokens = 1;
  } else if (response?.choices?.[0]?.message?.content) {
    const content = response.choices[0].message.content;
    completionTokens = Math.ceil(content.length / 4);
    promptTokens = Math.ceil(completionTokens * 0.5);
    totalTokens = promptTokens + completionTokens;
  }

  const costUsd = calculateCost(metadata.model, promptTokens, completionTokens);

  await trackAIUsage({
    userId: metadata.userId,
    userTier: metadata.userTier,
    feature: metadata.feature,
    model: metadata.model,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    requestDuration: duration,
  });

  return result;
}

export function estimateTokensFromText(text: string): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const completionTokens = Math.ceil(text.length / 4);
  const promptTokens = Math.ceil(completionTokens * 0.5);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}
