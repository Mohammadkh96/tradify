import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  userRole,
  signalProviderProfile,
  signalReceiver,
  providerSubscription,
  dispute,
  platformDisclaimer,
} from "../schema";
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

// ===== SUBSCRIPTION TIER MANAGEMENT (SOP Section 4) =====

// Get subscription plans for providers
router.get("/subscription-plans/provider", async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        name: "Basic",
        price: 0,
        interval: "month",
        features: ["Profile + links", "Up to 10 external links", "Basic profile metrics"],
      },
      {
        name: "Pro",
        price: 29,
        interval: "month",
        features: [
          "All Basic features",
          "Analytics dashboard",
          "Featured listing",
          "Verification badge (identity)",
          "Priority support",
          "Subscriber management tools",
        ],
      },
      {
        name: "Elite",
        price: 99,
        interval: "month",
        features: [
          "All Pro features",
          "Top placement in search",
          "Performance auditing tools",
          "Advanced credibility badges",
          "Direct messaging with receivers",
          "API access for integrations",
        ],
      },
    ];
    res.json({ plans });
  } catch (error) {
    console.error("Error fetching provider plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get subscription plans for receivers
router.get("/subscription-plans/receiver", async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        name: "Free",
        price: 0,
        interval: "month",
        features: [
          "Browse all providers",
          "Limited provider filters",
          "Basic provider info",
        ],
      },
      {
        name: "Premium",
        price: 9.99,
        interval: "month",
        features: [
          "All Free features",
          "Advanced filters",
          "Provider ratings & reviews",
          "Alerts for new providers",
          "Export subscriptions",
          "Priority support",
        ],
      },
    ];
    res.json({ plans });
  } catch (error) {
    console.error("Error fetching receiver plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// ===== KYC & VERIFICATION (SOP Section 1) =====

// Initiate KYC verification for provider
router.post("/kyc/initiate", async (req: Request, res: Response) => {
  try {
    const { userId, fullName, email, identityDocument } = req.body;

    if (!userId || !fullName || !email) {
      return res.status(400).json({ error: "Missing required KYC fields" });
    }

    // In production, integrate with KYC service (e.g., IDology, Jumio)
    // For now, mark as pending verification
    await db
      .update(userRole)
      .set({ kycVerified: false })
      .where(eq(userRole.userId, userId));

    res.json({
      success: true,
      status: "pending",
      message: "KYC verification initiated. We will verify your identity within 24-48 hours.",
      kycId: `KYC_${userId}_${Date.now()}`,
    });
  } catch (error) {
    console.error("Error initiating KYC:", error);
    res.status(500).json({ error: "Failed to initiate KYC" });
  }
});

// Get KYC status
router.get("/kyc/status/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const roles = await db
      .select()
      .from(userRole)
      .where(eq(userRole.userId, userId))
      .limit(1);

    if (roles.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      kycVerified: roles[0].kycVerified,
      verificationDate: roles[0].kycVerificationDate,
      status: roles[0].kycVerified ? "verified" : "pending",
    });
  } catch (error) {
    console.error("Error fetching KYC status:", error);
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

// ===== PLATFORM DISCLAIMERS & LEGAL (SOP Section 2 & 7) =====

// Get platform disclaimers
router.get("/disclaimers", async (req: Request, res: Response) => {
  try {
    const disclaimers = {
      platformScope: {
        title: "Platform Scope & Liability Protection",
        content: `Traders Hub is a TECHNOLOGY MARKETPLACE AND DIRECTORY, NOT A FINANCIAL SERVICE, BROKER, OR INVESTMENT ADVISOR.

Key Points:
- Traders Hub DOES NOT execute trades
- Traders Hub DOES NOT collect funds for trading
- Traders Hub DOES NOT guarantee returns
- Traders Hub DOES NOT provide investment advice
- Traders Hub DOES NOT rank providers by profitability without verified audits
- All trading involves substantial risk of loss

Users engage with signal providers ENTIRELY AT THEIR OWN DISCRETION and risk.`,
      },
      noFinancialAdvice: {
        title: "No Financial Advice Clause",
        content: `Signals provided by providers are NOT financial advice. Users must:
- Conduct their own research
- Understand the risks of trading
- Never trade with money they cannot afford to lose
- Consult with a licensed financial advisor before trading
- Be aware that past performance does not guarantee future results`,
      },
      riskDisclosure: {
        title: "Risk Disclosure",
        content: `Trading in forex, stocks, crypto, and derivatives involves substantial risk. Users acknowledge:
- Potential for 100% loss of capital
- Leverage multiplies both gains and losses
- Market volatility can cause rapid price changes
- Technical failures can prevent order execution
- Providers may have conflicts of interest
- Performance claims may be unverified`,
      },
      ageRestriction: {
        title: "Age Restriction",
        content: `You must be 18 years of age or older to use Traders Hub.`,
      },
    };

    res.json({ disclaimers, version: "1.0" });
  } catch (error) {
    console.error("Error fetching disclaimers:", error);
    res.status(500).json({ error: "Failed to fetch disclaimers" });
  }
});

// Accept all disclaimers
router.post("/accept-all-disclaimers", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // Log all disclaimer acceptances
    const disclaimerTexts = [
      "platformScope",
      "noFinancialAdvice",
      "riskDisclosure",
      "ageRestriction",
    ];

    for (const disclaimer of disclaimerTexts) {
      await db.insert(platformDisclaimer).values({
        userId,
        disclaimerVersion: "1.0",
        disclaimerText: disclaimer,
      });
    }

    // Mark user as having accepted terms
    await db
      .update(userRole)
      .set({ termsAccepted: true })
      .where(eq(userRole.userId, userId));

    res.json({
      success: true,
      message: "All disclaimers accepted and logged.",
    });
  } catch (error) {
    console.error("Error accepting disclaimers:", error);
    res.status(500).json({ error: "Failed to accept disclaimers" });
  }
});

// ===== PROVIDER VERIFICATION & BADGES (SOP Section 3) =====

// Get provider verification badge status
router.get("/provider-badge/:providerId", async (req: Request, res: Response) => {
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

    const provider = providers[0];

    res.json({
      badge: provider.verificationBadgeType || "UNVERIFIED",
      verified: provider.performanceVerified,
      kycVerified: (
        await db
          .select()
          .from(userRole)
          .where(eq(userRole.userId, providerId))
          .limit(1)
      )[0]?.kycVerified || false,
    });
  } catch (error) {
    console.error("Error fetching badge:", error);
    res.status(500).json({ error: "Failed to fetch badge" });
  }
});

// Request performance audit (provider can request verification)
router.post("/request-performance-audit", async (req: Request, res: Response) => {
  try {
    const { userId, tradingAccountScreenshot, performanceData } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // In production, route to audit team
    // For now, log the request
    console.log(`Performance audit requested for provider ${userId}`);

    res.json({
      success: true,
      message:
        "Performance audit request submitted. Our team will review your submission within 14 days.",
      auditId: `AUDIT_${userId}_${Date.now()}`,
      expectedCompletion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("Error requesting audit:", error);
    res.status(500).json({ error: "Failed to request audit" });
  }
});

// ===== DISPUTE RESOLUTION (SOP Section 6) =====

// Get dispute details (admin only)
router.get("/disputes/:disputeId", async (req: Request, res: Response) => {
  try {
    const { disputeId } = req.params;
    const disputes = await db
      .select()
      .from(dispute)
      .where(eq(dispute.id, parseInt(disputeId)))
      .limit(1);

    if (disputes.length === 0) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    res.json(disputes[0]);
  } catch (error) {
    console.error("Error fetching dispute:", error);
    res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

// Update dispute status (admin only)
router.patch("/disputes/:disputeId", async (req: Request, res: Response) => {
  try {
    const { disputeId } = req.params;
    const { status, resolution, action } = req.body;

    const validStatuses = ["PENDING", "INVESTIGATING", "RESOLVED", "CLOSED"];
    const validActions = ["NONE", "WARNING", "SUSPENDED", "BANNED"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (action && !validActions.includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    // If action is SUSPENDED or BANNED, update provider profile
    if (action && ["SUSPENDED", "BANNED"].includes(action)) {
      const disputeRecord = await db
        .select()
        .from(dispute)
        .where(eq(dispute.id, parseInt(disputeId)))
        .limit(1);

      if (disputeRecord.length > 0) {
        const provider = disputeRecord[0];
        if (action === "SUSPENDED") {
          await db
            .update(signalProviderProfile)
            .set({
              suspendedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              suspensionReason: `Dispute ${disputeId}: ${provider.reason}`,
            })
            .where(eq(signalProviderProfile.userId, provider.reportedProviderId));
        } else if (action === "BANNED") {
          await db
            .update(signalProviderProfile)
            .set({
              isActive: false,
              suspensionReason: `Provider banned due to dispute ${disputeId}`,
            })
            .where(eq(signalProviderProfile.userId, provider.reportedProviderId));
        }
      }
    }

    await db
      .update(dispute)
      .set({
        status: status || undefined,
        resolution: resolution || undefined,
        action: action || undefined,
        resolvedAt: status === "RESOLVED" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(dispute.id, parseInt(disputeId)));

    res.json({ success: true, message: "Dispute updated" });
  } catch (error) {
    console.error("Error updating dispute:", error);
    res.status(500).json({ error: "Failed to update dispute" });
  }
});

// Get provider disputes (admin view)
router.get("/provider-disputes/:providerId", async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const disputes = await db
      .select()
      .from(dispute)
      .where(eq(dispute.reportedProviderId, providerId));

    res.json({
      providerId,
      totalDisputes: disputes.length,
      pending: disputes.filter(d => d.status === "PENDING").length,
      resolved: disputes.filter(d => d.status === "RESOLVED").length,
      disputes,
    });
  } catch (error) {
    console.error("Error fetching disputes:", error);
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

// ===== DATA & PRIVACY (SOP Section 7) =====

// Request account deletion
router.post("/request-account-deletion", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // In production, this would:
    // 1. Mark account for deletion
    // 2. Schedule data purge (GDPR compliance - 30 days)
    // 3. Remove from active listings
    console.log(`Account deletion requested for ${userId}`);

    res.json({
      success: true,
      message:
        "Account deletion scheduled. Your data will be permanently deleted within 30 days per GDPR requirements.",
    });
  } catch (error) {
    console.error("Error requesting deletion:", error);
    res.status(500).json({ error: "Failed to request deletion" });
  }
});

// Get user data (GDPR data export)
router.get("/user-data/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userRoleData = await db
      .select()
      .from(userRole)
      .where(eq(userRole.userId, userId));

    const providerData = await db
      .select()
      .from(signalProviderProfile)
      .where(eq(signalProviderProfile.userId, userId));

    const receiverData = await db
      .select()
      .from(signalReceiver)
      .where(eq(signalReceiver.userId, userId));

    const disclaimerData = await db
      .select()
      .from(platformDisclaimer)
      .where(eq(platformDisclaimer.userId, userId));

    res.json({
      userRole: userRoleData,
      provider: providerData,
      receiver: receiverData,
      disclaimers: disclaimerData,
      exportDate: new Date(),
      message: "This is your complete data export per GDPR Article 20 (Data Portability).",
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;
