import { Router, Request, Response } from "express";
import { db } from "./db";
import {
  userRole,
  signalProviderProfile,
  signalReceiver,
  providerSubscription,
  dispute,
  platformDisclaimer,
} from "@shared/schema";
import { eq, and, or, desc, like, sql } from "drizzle-orm";

const router = Router();

// Role selection endpoint
router.post("/select-role", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ error: "Missing userId or role" });
    }
    if (!["PROVIDER", "RECEIVER"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const roles = await db
      .select()
      .from(userRole)
      .where(eq(userRole.userId, userId))
      .limit(1);

    if (roles.length > 0) {
      await db
        .update(userRole)
        .set({ role, updatedAt: new Date() })
        .where(eq(userRole.userId, userId));
    } else {
      await db.insert(userRole).values({
        userId,
        role,
        termsAccepted: false,
        riskAcknowledged: false,
      });
    }

    res.json({ success: true, role });
  } catch (error) {
    console.error("Error selecting role:", error);
    res.status(500).json({ error: "Failed to select role" });
  }
});

// Get user role
router.get("/user-role/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const roles = await db
      .select()
      .from(userRole)
      .where(eq(userRole.userId, userId))
      .limit(1);

    if (roles.length === 0) {
      return res.status(404).json({ error: "User role not found" });
    }

    res.json(roles[0]);
  } catch (error) {
    console.error("Error fetching user role:", error);
    res.status(500).json({ error: "Failed to fetch user role" });
  }
});

// Accept terms
router.post("/accept-terms", async (req: Request, res: Response) => {
  try {
    const { userId, disclaimerVersion, disclaimerText } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    await db.insert(platformDisclaimer).values({
      userId,
      disclaimerVersion: disclaimerVersion || "1.0",
      disclaimerText: disclaimerText || "Platform Disclaimer",
    });

    await db
      .update(userRole)
      .set({ termsAccepted: true, updatedAt: new Date() })
      .where(eq(userRole.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error accepting terms:", error);
    res.status(500).json({ error: "Failed to accept terms" });
  }
});

// Acknowledge risk
router.post("/acknowledge-risk", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    await db
      .update(userRole)
      .set({ riskAcknowledged: true, updatedAt: new Date() })
      .where(eq(userRole.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error acknowledging risk:", error);
    res.status(500).json({ error: "Failed to acknowledge risk" });
  }
});

// Provider profile
router.post("/provider-profile", async (req: Request, res: Response) => {
  try {
    const { userId, ...profileData } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const profiles = await db
      .select()
      .from(signalProviderProfile)
      .where(eq(signalProviderProfile.userId, userId))
      .limit(1);

    if (profiles.length > 0) {
      await db
        .update(signalProviderProfile)
        .set({ ...profileData, updatedAt: new Date() })
        .where(eq(signalProviderProfile.userId, userId));
    } else {
      await db.insert(signalProviderProfile).values({
        userId,
        providerName: profileData.providerName || "Unknown",
        ...profileData,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving provider profile:", error);
    res.status(500).json({ error: "Failed to save provider profile" });
  }
});

// Get provider profile
router.get("/provider-profile/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profiles = await db
      .select()
      .from(signalProviderProfile)
      .where(eq(signalProviderProfile.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profiles[0]);
  } catch (error) {
    console.error("Error fetching provider profile:", error);
    res.status(500).json({ error: "Failed to fetch provider profile" });
  }
});

// Receiver profile
router.post("/receiver-profile", async (req: Request, res: Response) => {
  try {
    const { userId, ...profileData } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const profiles = await db
      .select()
      .from(signalReceiver)
      .where(eq(signalReceiver.userId, userId))
      .limit(1);

    if (profiles.length > 0) {
      await db
        .update(signalReceiver)
        .set({ ...profileData, updatedAt: new Date() })
        .where(eq(signalReceiver.userId, userId));
    } else {
      await db.insert(signalReceiver).values({
        userId,
        receiverName: profileData.receiverName || "Unknown",
        ...profileData,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving receiver profile:", error);
    res.status(500).json({ error: "Failed to save receiver profile" });
  }
});

// List providers
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const { search, sort = "recent", limit = 20, offset = 0 } = req.query;

    let query = db
      .select()
      .from(signalProviderProfile)
      .where(eq(signalProviderProfile.isActive, true));

    if (search && typeof search === "string") {
      query = query.where(
        or(
          like(signalProviderProfile.providerName, `%${search}%`),
          like(signalProviderProfile.bio, `%${search}%`)
        )
      );
    }

    switch (sort) {
      case "topRated":
        query = query.orderBy(desc(signalProviderProfile.winRate));
        break;
      case "mostSubscribed":
        query = query.orderBy(desc(signalProviderProfile.subscriberCount));
        break;
      default:
        query = query.orderBy(desc(signalProviderProfile.createdAt));
    }

    const providers = await query
      .limit(parseInt(limit as string) || 20)
      .offset(parseInt(offset as string) || 0);

    res.json({ providers });
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});

// Get provider details
router.get("/provider/:providerId", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const providers = await db
      .select()
      .from(signalProviderProfile)
      .where(eq(signalProviderProfile.userId, providerId))
      .limit(1);

    if (providers.length === 0) {
      return res.status(404).json({ error: "Provider not found" });
    }

    await db
      .update(signalProviderProfile)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(signalProviderProfile.userId, providerId));

    const subscribers = await db
      .select()
      .from(providerSubscription)
      .where(
        and(
          eq(providerSubscription.providerId, providerId),
          eq(providerSubscription.subscriptionStatus, "ACTIVE")
        )
      );

    res.json({ provider: providers[0], subscriberCount: subscribers.length });
  } catch (error) {
    console.error("Error fetching provider details:", error);
    res.status(500).json({ error: "Failed to fetch provider details" });
  }
});

// Subscribe to provider
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { receiverId, providerId, externalPlatform, externalUserId } =
      req.body;

    if (!receiverId || !providerId) {
      return res.status(400).json({ error: "Missing receiverId or providerId" });
    }

    await db.insert(providerSubscription).values({
      receiverId,
      providerId,
      subscriptionStatus: "ACTIVE",
      externalPlatform: externalPlatform || "TELEGRAM",
      externalUserId,
    });

    await db
      .update(signalProviderProfile)
      .set({ subscriberCount: sql`subscriber_count + 1` })
      .where(eq(signalProviderProfile.userId, providerId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error subscribing:", error);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

// Unsubscribe
router.post("/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { receiverId, providerId } = req.body;

    if (!receiverId || !providerId) {
      return res.status(400).json({ error: "Missing receiverId or providerId" });
    }

    await db
      .update(providerSubscription)
      .set({ subscriptionStatus: "CANCELLED", cancelledAt: new Date() })
      .where(
        and(
          eq(providerSubscription.receiverId, receiverId),
          eq(providerSubscription.providerId, providerId)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error("Error unsubscribing:", error);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// Report provider
router.post("/report-provider", async (req: Request, res: Response) => {
  try {
    const { reporterId, reportedProviderId, reason, description } = req.body;

    if (!reporterId || !reportedProviderId || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const validReasons = [
      "FAKE_RESULTS",
      "SCAM",
      "ABUSIVE",
      "MISLEADING_CLAIMS",
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: "Invalid reason" });
    }

    await db.insert(dispute).values({
      reporterId,
      reportedProviderId,
      reason,
      description,
      status: "PENDING",
    });

    res.json({
      success: true,
      message:
        "Report submitted. Our team will investigate within 7 days.",
    });
  } catch (error) {
    console.error("Error reporting provider:", error);
    res.status(500).json({ error: "Failed to report provider" });
  }
});

// Sync Token Management
router.post("/generate-token", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    await db.update(userRole)
      .set({ syncToken: token, updatedAt: new Date() })
      .where(eq(userRole.userId, userId));

    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

export default router;
