import express from "express";
import { storage } from "./storage";
import { insertHubPostSchema, insertHubCommentSchema, insertHubReportSchema, insertCreatorApplicationSchema, insertCreatorProfileSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

// Creator Program Endpoints
router.get("/creators", async (req, res) => {
  try {
    const creators = await storage.getAllApprovedCreators();
    res.json(creators);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch creators" });
  }
});

router.get("/creators/:userId", async (req, res) => {
  try {
    const profile = await storage.getCreatorProfile(req.params.userId);
    if (!profile || profile.status !== "APPROVED") {
      return res.status(404).json({ message: "Creator not found" });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch creator profile" });
  }
});

router.post("/apply", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const appData = insertCreatorApplicationSchema.parse(req.body);
    const application = await storage.createCreatorApplication({ ...appData, userId });
    res.status(201).json(application);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Application failed" });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const profile = await storage.getCreatorProfile(userId);
    if (!profile || profile.status !== "APPROVED") {
      return res.status(403).json({ message: "Only approved creators can edit profiles" });
    }

    const updates = insertCreatorProfileSchema.partial().parse(req.body);
    const updated = await storage.updateCreatorProfile(userId, updates);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Content Moderation (Basic Keyword Filtering)
const BANNED_KEYWORDS = [
  "buy now", "sell now", "guaranteed", "easy profit", "can't fail", 
  "copy my trades", "mirror my", "roi", "signals", "entry here"
];

const containsProhibitedLanguage = (text: string) => {
  const lower = text.toLowerCase();
  return BANNED_KEYWORDS.some(k => lower.includes(k));
};

router.get("/posts", async (req, res) => {
  try {
    const posts = await storage.getHubPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch hub posts" });
  }
});

router.post("/posts", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const postData = insertHubPostSchema.parse(req.body);
    
    if (containsProhibitedLanguage(postData.content) || containsProhibitedLanguage(postData.title)) {
      return res.status(400).json({ 
        message: "Post contains prohibited language. Signals, guarantees, and advisory content are not allowed." 
      });
    }

    const post = await storage.createHubPost({ ...postData, userId });
    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Failed to create post" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await storage.getUserRole(userId);
    const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";
    
    const success = await storage.deleteHubPost(parseInt(req.params.id), userId, isAdmin);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(403).json({ message: "Unauthorized or post not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const reportData = insertHubReportSchema.parse(req.body);
    const report = await storage.reportHubPost({ ...reportData, userId });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ message: "Failed to file report" });
  }
});

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const comments = await storage.getHubComments(parseInt(req.params.postId));
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

router.post("/posts/:postId/comments", async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const commentData = insertHubCommentSchema.parse(req.body);
    const comment = await storage.createHubComment({ ...commentData, userId });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: "Failed to post comment" });
  }
});

router.get("/user-role/:userId", async (req, res) => {
  try {
    const user = await storage.getUserRole(req.params.userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user role" });
  }
});

export default router;
