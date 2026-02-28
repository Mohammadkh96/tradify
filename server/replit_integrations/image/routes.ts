import type { Express, Request, Response } from "express";
import { openai } from "./client";
import { trackAIUsage, calculateCost } from "../../ai-cost-tracker";

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const imgStartTime = Date.now();
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: size as "1024x1024" | "512x512" | "256x256",
      });
      const imgDuration = Date.now() - imgStartTime;

      trackAIUsage({
        userId: (req as any).session?.userId || "anonymous",
        userTier: "FREE",
        feature: "image_generation",
        model: "gpt-image-1",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 1,
        costUsd: calculateCost("gpt-image-1", 0, 0),
        requestDuration: imgDuration,
      }).catch(err => console.error("[AI Cost Tracker] image_generation error:", err));

      const imageData = response.data[0];
      res.json({
        url: imageData.url,
        b64_json: imageData.b64_json,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}

