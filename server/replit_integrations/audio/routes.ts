import type { Express, Request, Response } from "express";
import { chatStorage } from "../chat/storage";
import { openai, speechToText, voiceChatWithTextModel } from "./client";
import { trackAIUsage, calculateCost, estimateTokensFromText, getUserTier } from "../../ai-cost-tracker";

export function registerAudioRoutes(app: Express): void {
  // Get all conversations
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send voice message and get streaming audio response
  // Uses gpt-4o-mini-transcribe for STT, gpt-audio-mini for voice response
  // For text model control, chain: speechToText() -> text model -> textToSpeech()
  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { audio, voice = "alloy", inputFormat = "wav" } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      // 1. Transcribe user audio
      const audioBuffer = Buffer.from(audio, "base64");
      const audioUserId = (req as any).session?.userId || "anonymous";
      const audioUserTier = await getUserTier(audioUserId);
      const sttStartTime = Date.now();
      const userTranscript = await speechToText(audioBuffer, inputFormat);
      const sttDuration = Date.now() - sttStartTime;

      trackAIUsage({
        userId: audioUserId,
        userTier: audioUserTier,
        feature: "transcription",
        model: "gpt-4o-mini-transcribe",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: Math.ceil(userTranscript.length / 4),
        costUsd: calculateCost("gpt-4o-mini-transcribe", Math.ceil(audioBuffer.length / 16000 * 60), 0),
        requestDuration: sttDuration,
      }).catch(err => console.error("[AI Cost Tracker] transcription error:", err));

      // 2. Save user message
      await chatStorage.createMessage(conversationId, "user", userTranscript);

      // 3. Get conversation history
      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const chatHistory = existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // 4. Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

      // 5. Stream audio response from gpt-audio-mini
      const voiceStartTime = Date.now();
      const stream = await openai.chat.completions.create({
        model: "gpt-audio-mini",
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        messages: chatHistory,
        stream: true,
      });

      let assistantTranscript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.audio?.transcript) {
          assistantTranscript += delta.audio.transcript;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}\n\n`);
        }

        if (delta?.audio?.data) {
          res.write(`data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}\n\n`);
        }
      }
      const voiceDuration = Date.now() - voiceStartTime;

      const voiceEstimated = estimateTokensFromText(assistantTranscript);
      trackAIUsage({
        userId: audioUserId,
        userTier: audioUserTier,
        feature: "voice_chat",
        model: "gpt-audio-mini",
        promptTokens: voiceEstimated.promptTokens,
        completionTokens: voiceEstimated.completionTokens,
        totalTokens: voiceEstimated.totalTokens,
        costUsd: calculateCost("gpt-audio-mini", voiceEstimated.promptTokens, voiceEstimated.completionTokens),
        requestDuration: voiceDuration,
      }).catch(err => console.error("[AI Cost Tracker] voice_chat error:", err));

      // 6. Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", assistantTranscript);

      res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error processing voice message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process voice message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process voice message" });
      }
    }
  });

  // Voice chat using separate text model (GPT-5) + TTS pipeline
  // Streams sentences to TTS as they're generated for lower latency
  // Supports multilingual sentence detection via locale parameter
  app.post("/api/conversations/:id/voice-stream", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const { audio, voice = "alloy", inputFormat = "wav", locale = "en" } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }

      // Get conversation history
      const existingMessages = await chatStorage.getMessagesByConversation(conversationId);
      const chatHistory = existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const audioBuffer = Buffer.from(audio, "base64");
      const vsUserId = (req as any).session?.userId || "anonymous";
      const vsUserTier = await getUserTier(vsUserId);
      let userTranscript = "";
      let assistantTranscript = "";
      const vsStartTime = Date.now();

      // Stream the voice chat pipeline
      for await (const event of voiceChatWithTextModel(audioBuffer, {
        voice,
        inputFormat,
        chatHistory,
        locale,
      })) {
        if (event.type === "user_transcript") {
          userTranscript = event.data || "";
          await chatStorage.createMessage(conversationId, "user", userTranscript);
        }
        if (event.type === "transcript") {
          assistantTranscript = event.data || "";
        }

        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      const vsDuration = Date.now() - vsStartTime;

      const vsEstimated = estimateTokensFromText(assistantTranscript);
      trackAIUsage({
        userId: vsUserId,
        userTier: vsUserTier,
        feature: "voice_chat",
        model: "gpt-audio-mini",
        promptTokens: vsEstimated.promptTokens,
        completionTokens: vsEstimated.completionTokens,
        totalTokens: vsEstimated.totalTokens,
        costUsd: calculateCost("gpt-audio-mini", vsEstimated.promptTokens, vsEstimated.completionTokens),
        requestDuration: vsDuration,
      }).catch(err => console.error("[AI Cost Tracker] voice_stream error:", err));

      // Save assistant message
      await chatStorage.createMessage(conversationId, "assistant", assistantTranscript);
      res.end();
    } catch (error) {
      console.error("Error in voice stream:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Voice stream failed" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Voice stream failed" });
      }
    }
  });
}
