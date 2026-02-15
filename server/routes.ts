import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import tradersHubRouter from "./traders-hub";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, or, desc, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { emailService } from "./emailService";
import { openai } from "./replit_integrations/audio/index";
import { isPaidTier, getMaxStrategies, canAccessFeature, getHistoryDays, PLAN_FEATURES } from "@shared/plans";
import { TRADING_KNOWLEDGE_CONTEXT, AI_SYSTEM_CONTEXT } from "./tradingKnowledge";
// Removed pdfkit - using client-side PDF generation with jspdf

const PostgresStore = connectPg(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
  }
}

// Helper function to get date cutoff based on subscription tier
function getTierDateCutoff(historyDays: number): Date | null {
  // -1 means unlimited (Elite)
  if (historyDays === -1) {
    return null; // No cutoff, return all data
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  return cutoff;
}

// Filter trades by tier date limits (returns filtered array)
function filterByTierDate<T extends { closeTime?: Date | string | null; createdAt?: Date | string | null }>(
  items: T[],
  historyDays: number
): T[] {
  const cutoff = getTierDateCutoff(historyDays);
  if (!cutoff) return items; // Unlimited access
  
  return items.filter(item => {
    const itemDate = item.closeTime ? new Date(item.closeTime) : 
                     item.createdAt ? new Date(item.createdAt) : null;
    return itemDate && itemDate >= cutoff;
  });
}

// Shared date filter helper - uses UTC for consistent filtering
function isWithinDateRangeUTC(
  tradeDate: Date,
  dateFilter: string | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateFilter || dateFilter === "all") return true;
  
  const now = new Date();
  
  // Get UTC date components for the trade
  const tradeYear = tradeDate.getUTCFullYear();
  const tradeMonth = tradeDate.getUTCMonth();
  const tradeDay = tradeDate.getUTCDate();
  const tradeUTCDate = new Date(Date.UTC(tradeYear, tradeMonth, tradeDay));
  
  if (dateFilter === "today") {
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));
    return tradeUTCDate >= todayUTC;
  }
  
  if (dateFilter === "week") {
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const weekStartUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - dayOfWeek
    ));
    return tradeUTCDate >= weekStartUTC;
  }
  
  if (dateFilter === "month") {
    const monthStartUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1
    ));
    return tradeUTCDate >= monthStartUTC;
  }
  
  if (dateFilter === "custom" && startDate && endDate) {
    // Parse dates as local then convert to UTC for comparison
    const start = new Date(startDate);
    const startUTC = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const end = new Date(endDate);
    const endUTC = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999));
    return tradeUTCDate >= startUTC && tradeUTCDate <= endUTC;
  }
  
  return true;
}

// Authentication middleware
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Session expired. Please log in." });
  }
  next();
};

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Session expired" });
  }
  
  const user = await storage.getUserRole(req.session.userId);
  if (user?.role !== "OWNER" && user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";
import { paypalService } from "./paypalService";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint for deployment (must be before session middleware)
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Trust proxy for Vercel (required for secure cookies behind proxy)
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  
  // Session setup
  app.use(session({
    store: new PostgresStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      },
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "tradify_secret_2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax"
    }
  }));

  // Add body parser limits for MT5 payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Early Access Signup Endpoint
  app.post("/api/early-access/signup", async (req, res) => {
    try {
      const { email, fullName } = req.body;
      
      if (!email || !email.includes("@")) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      
      // Check if already signed up
      const [existing] = await db.select()
        .from(schema.earlyAccessSignups)
        .where(eq(schema.earlyAccessSignups.email, normalizedEmail))
        .limit(1);
      
      if (existing) {
        return res.status(400).json({ message: "You're already on the list!" });
      }
      
      // Insert new signup
      await db.insert(schema.earlyAccessSignups).values({
        email: normalizedEmail,
        fullName: fullName?.trim() || null,
        source: "early_access_page",
        status: "pending"
      });
      
      res.json({ success: true, message: "You've been added to the founding member list!" });
    } catch (error: any) {
      console.error("Early access signup error:", error);
      res.status(500).json({ message: "Failed to sign up. Please try again." });
    }
  });
  
  // Registration Endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, fullName, country, phoneNumber, timezone } = req.body;
      
      if (!email || !password || !fullName || !country || !timezone) {
        return res.status(400).json({ message: "Required fields missing" });
      }

      const normalizedEmail = email.toLowerCase();
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists." });
      }

      // Check if this email has an early access signup - auto-grant founding member status
      const [earlyAccessRecord] = await db.select()
        .from(schema.earlyAccessSignups)
        .where(eq(schema.earlyAccessSignups.email, normalizedEmail))
        .limit(1);
      
      const isFoundingMember = !!earlyAccessRecord;

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate email verification token
      const crypto = await import("crypto");
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Founding members get 1 month free Pro access
      const foundingMemberProExpiry = isFoundingMember 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        : null;

      const [newUser] = await db.insert(schema.userRole).values({
        userId: normalizedEmail,
        password: hashedPassword,
        role: "TRADER",
        fullName,
        country,
        phoneNumber: phoneNumber || null,
        timezone,
        subscriptionTier: isFoundingMember ? "PRO" : "FREE",
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: tokenExpiry,
        hasSeenTour: false,
        foundingMember: isFoundingMember,
        foundingMemberProExpiry: foundingMemberProExpiry,
      }).returning();

      // If early access signup exists, update it to link to the user (don't block registration)
      if (earlyAccessRecord) {
        db.update(schema.earlyAccessSignups)
          .set({
            status: "registered",
            registeredUserId: normalizedEmail,
          })
          .where(eq(schema.earlyAccessSignups.id, earlyAccessRecord.id))
          .catch(err => console.error("Failed to update early access record:", err));
      }

      // Send verification email (don't await - run in background so registration doesn't fail if email fails)
      emailService.sendTransactionalEmail(newUser.userId, "email_verification", {
        verificationToken,
        fullName,
      }).catch(err => console.error("Failed to send verification email:", err));

      // Notify admin of new signup (don't await - run in background)
      emailService.sendAdminSignupNotification(normalizedEmail, fullName, country, isFoundingMember)
        .catch(err => console.error("Failed to send admin signup notification:", err));

      res.status(201).json({ 
        message: isFoundingMember 
          ? "Founding member account created! Please check your email to verify your account."
          : "Account created. Please check your email to verify your account.",
        requiresVerification: true,
        userId: newUser.userId,
        foundingMember: isFoundingMember,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.redirect("/login?verification_error=invalid_token");
      }

      const [user] = await db.select().from(schema.userRole)
        .where(eq(schema.userRole.emailVerificationToken, token))
        .limit(1);

      if (!user) {
        return res.redirect("/login?verification_error=invalid_token");
      }

      if (user.emailVerificationExpiry && new Date(user.emailVerificationExpiry) < new Date()) {
        return res.redirect(`/login?verification_error=expired&email=${encodeURIComponent(user.userId)}`);
      }

      await db.update(schema.userRole)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        })
        .where(eq(schema.userRole.userId, user.userId));

      // Redirect to login with success message
      res.redirect("/login?verified=true");
    } catch (error) {
      console.error("Email verification error:", error);
      res.redirect("/login?verification_error=failed");
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = email.toLowerCase();

      const [user] = await db.select().from(schema.userRole)
        .where(eq(schema.userRole.userId, normalizedEmail))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "Account not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Generate new verification token
      const crypto = await import("crypto");
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.update(schema.userRole)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationExpiry: tokenExpiry,
        })
        .where(eq(schema.userRole.userId, user.userId));

      await emailService.sendTransactionalEmail(user.userId, "email_verification", {
        verificationToken,
        fullName: user.fullName || "Trader",
      });

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Login Endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase();
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      
      if (!user || user.role === "DEACTIVATED") {
        return res.status(401).json({ message: "Account disabled or not found" });
      }

      if (!user.password || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Check if email is verified (skip for admins/owners)
      if (!user.emailVerified && user.role !== "OWNER" && user.role !== "ADMIN") {
        return res.status(403).json({ 
          message: "Please verify your email before logging in",
          requiresVerification: true,
          email: user.userId
        });
      }

      // Check if user needs to reset password (admin-created accounts)
      if (user.mustResetPassword) {
        // Create a temporary session for password reset only
        req.session.userId = user.userId;
        req.session.role = user.role;
        return res.json({ 
          ...user, 
          requiresPasswordReset: true 
        });
      }

      req.session.userId = user.userId;
      req.session.role = user.role;

      // Check if this is first login (for tour)
      const isFirstLogin = !user.hasSeenTour;

      res.json({ ...user, isFirstLogin });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Reset password endpoint for first-time users
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { newPassword, confirmPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.update(schema.userRole)
        .set({ 
          password: hashedPassword, 
          mustResetPassword: false,
          updatedAt: new Date()
        })
        .where(eq(schema.userRole.userId, req.session.userId));

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserRole(req.session.userId);
    
    // Check if founding member free Pro has expired
    if (user && user.foundingMember && user.foundingMemberProExpiry && 
        user.subscriptionTier === "PRO") {
      const hasActiveSubscription = user.subscriptionStatus === "ACTIVE" || user.subscriptionStatus === "active";
      if (!hasActiveSubscription) {
        const now = new Date();
        if (now > new Date(user.foundingMemberProExpiry)) {
          await db.update(schema.userRole)
            .set({ subscriptionTier: "FREE", updatedAt: new Date() })
            .where(eq(schema.userRole.userId, req.session.userId!));
          user.subscriptionTier = "FREE";
        }
      }
    }
    
    res.json(user);
  });

  // Mark tour as seen
  app.post("/api/user/tour-complete", requireAuth, async (req, res) => {
    try {
      await db.update(schema.userRole)
        .set({ hasSeenTour: true })
        .where(eq(schema.userRole.userId, req.session.userId!));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking tour complete:", error);
      res.status(500).json({ message: "Failed to update tour status" });
    }
  });

  app.get("/api/paypal/setup", requireAuth, async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", requireAuth, async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", requireAuth, async (req, res) => {
    // Store the original json function to intercept the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // If capture was successful (status COMPLETED), upgrade the user
      if (data && data.status === 'COMPLETED') {
        const userId = req.session.userId!;
        storage.updateUserSubscriptionInfo(userId, {
          subscriptionTier: 'PRO',
          subscriptionProvider: 'paypal',
          paypalSubscriptionId: data.id || null,
        }).catch(err => console.error('Failed to upgrade user after PayPal payment:', err));
      }
      return originalJson(data);
    };
    await capturePaypalOrder(req, res);
  });

  app.post("/api/paypal/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const rawBody = req.body.toString();
      const payload = JSON.parse(rawBody);
      await paypalService.handleWebhook(payload, req.headers, rawBody);
      res.sendStatus(200);
    } catch (error) {
      console.error("PayPal webhook error:", error);
      res.sendStatus(500);
    }
  });

  // Activate subscription after PayPal redirect (called from Checkout page)
  app.post("/api/paypal/subscription/activate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { subscriptionId } = req.body;
      
      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID required" });
      }

      const activated = await paypalService.activateSubscriptionByUser(userId, subscriptionId);
      
      if (activated) {
        res.json({ success: true, message: "Subscription activated" });
      } else {
        res.status(400).json({ error: "Failed to activate subscription" });
      }
    } catch (error) {
      console.error("Subscription activation error:", error);
      res.status(500).json({ error: "Failed to activate subscription" });
    }
  });

  // PayPal Subscription endpoints
  app.post("/api/paypal/subscribe", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { tier = 'PRO' } = req.body;
      const validTier = tier === 'ELITE' ? 'ELITE' : 'PRO';
      
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      const result = await paypalService.createSubscription(
        userId,
        `${baseUrl}/checkout?subscription=success&tier=${validTier}`,
        `${baseUrl}/checkout?subscription=cancelled`,
        validTier
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("PayPal subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  app.get("/api/paypal/subscription", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserRole(userId);
      
      if (!user?.paypalSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      
      const details = await paypalService.getSubscriptionDetails(user.paypalSubscriptionId);
      res.json({
        subscriptionId: details.id,
        status: details.status,
        startTime: details.start_time,
        nextBillingTime: details.billing_info?.next_billing_time,
        lastPayment: details.billing_info?.last_payment,
        planName: details.plan_id,
      });
    } catch (error: any) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to get subscription details" });
    }
  });

  app.post("/api/paypal/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUserRole(userId);
      
      if (!user?.paypalSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      
      await paypalService.cancelSubscription(user.paypalSubscriptionId, req.body.reason || 'User requested cancellation');
      
      // Only update status to cancelled - user keeps PRO access until billing period ends
      // The actual downgrade to FREE happens when PayPal sends BILLING.SUBSCRIPTION.EXPIRED webhook
      await storage.updateUserSubscriptionInfo(userId, {
        subscriptionStatus: 'cancelled',
        // Keep subscriptionTier as PRO - user retains access until billing period ends
      });
      
      res.json({ success: true, message: "Subscription cancelled successfully" });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Traders Hub API
  app.use("/api/traders-hub", requireAuth, tradersHubRouter);
  
  app.get(api.trades.list.path, requireAuth, async (req, res) => {
    const userId = req.session.userId!;
    const userRole = await storage.getUserRole(userId);
    const historyDays = getHistoryDays(userRole?.subscriptionTier);
    
    const allTrades = await storage.getTrades(userId);
    const filteredTrades = filterByTierDate(allTrades, historyDays);
    res.json(filteredTrades);
  });

  app.get(api.trades.get.path, requireAuth, async (req, res) => {
    const trade = await storage.getTrade(Number(req.params.id));
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }
    // Access control: ensure user can only access their own trades
    if (trade.userId !== req.session.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(trade);
  });

  app.post(api.trades.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.trades.create.input.parse(req.body);
      const trade = await storage.createTrade({ ...input, userId: req.session.userId! });
      res.status(201).json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.trades.validate.path, (req, res) => {
    try {
      const input = api.trades.validate.input.parse(req.body);
      const result = storage.validateTradeRules(input);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.trades.update.path, async (req, res) => {
    try {
      const input = api.trades.update.input.parse(req.body);
      const trade = await storage.updateTrade(Number(req.params.id), input);
      if (!trade) {
        return res.status(404).json({ message: 'Trade not found' });
      }
      res.json(trade);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.trades.delete.path, async (req, res) => {
    await storage.deleteTrade(Number(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/trades/:id/annotations", requireAuth, async (req, res) => {
    try {
      const tradeId = Number(req.params.id);
      const userId = req.session.userId!;
      const { mood, mistakeCategory, source } = req.body;
      const updateData: any = {};
      if (mood !== undefined) updateData.mood = mood;
      if (mistakeCategory !== undefined) updateData.mistakeCategory = mistakeCategory;

      if (source === "mt5") {
        await db.update(schema.mt5History)
          .set(updateData)
          .where(and(eq(schema.mt5History.id, tradeId), eq(schema.mt5History.userId, userId)));
      } else {
        await db.update(schema.tradeJournal)
          .set(updateData)
          .where(and(eq(schema.tradeJournal.id, tradeId), eq(schema.tradeJournal.userId, userId)));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating trade annotations:", error);
      res.status(500).json({ message: "Failed to update trade annotations" });
    }
  });

  app.patch("/api/user/dashboard-config", requireAuth, async (req, res) => {
    try {
      const { dashboardConfig } = req.body;
      await db.update(schema.userRole)
        .set({ dashboardConfig })
        .where(eq(schema.userRole.userId, req.session.userId!));
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving dashboard config:", error);
      res.status(500).json({ message: "Failed to save dashboard config" });
    }
  });

  app.post("/api/trades/import", requireAuth, async (req, res) => {
    try {
      const { trades } = req.body;
      if (!Array.isArray(trades) || trades.length === 0) {
        return res.status(400).json({ message: "No trades provided" });
      }
      if (trades.length > 500) {
        return res.status(400).json({ message: "Maximum 500 trades per import" });
      }

      const userId = req.session.userId!;
      const imported = [];
      for (const t of trades) {
        const trade = await storage.createTrade({
          userId,
          pair: t.pair || "UNKNOWN",
          direction: t.direction || "Long",
          timeframe: t.timeframe || "Imported",
          entryPrice: t.entryPrice || "",
          exitPrice: t.exitPrice || "",
          riskReward: t.riskReward || "",
          netPl: t.netPl || "0",
          outcome: t.outcome || "Break-even",
          notes: t.notes || "CSV Import",
        });
        imported.push(trade);
      }

      res.status(201).json({ imported: imported.length });
    } catch (error) {
      console.error("Error importing trades:", error);
      res.status(500).json({ message: "Failed to import trades" });
    }
  });

  app.delete("/api/admin/users/:targetUserId", requireAdmin, async (req, res) => {
    try {
      const { targetUserId } = req.params;
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, targetUserId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role === "OWNER") {
        return res.status(403).json({ message: "Cannot delete the Owner account" });
      }

      await db.delete(schema.userRole).where(eq(schema.userRole.userId, targetUserId));

      // Audit log for deletion
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: "DELETE_USER",
        targetUserId: targetUserId,
        details: { timestamp: new Date() }
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.get("/api/admin/emails", requireAdmin, async (req, res) => {
    try {
      const emails = await db.select().from(schema.sentEmails).orderBy(desc(schema.sentEmails.sentAt));
      res.json(emails);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  app.get("/api/admin/paypal/status", requireAdmin, async (req, res) => {
    try {
      const status = await paypalService.testConnection();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Error testing PayPal connection", 
        error: error.message 
      });
    }
  });

  app.post("/api/admin/trigger-email", requireAdmin, async (req, res) => {
    try {
      const { userId, type, data } = req.body;
      const success = await emailService.sendTransactionalEmail(userId, type, data || {});
      
      // Audit log for manual trigger
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: "MANUAL_EMAIL_TRIGGER",
        targetUserId: userId,
        details: { type, success }
      });

      if (success) {
        res.json({ message: "Email triggered successfully" });
      } else {
        res.status(500).json({ message: "Failed to trigger email" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error triggering email" });
    }
  });

  // MT5 Bridge Sync Endpoint (REST API for Python Connector)
  // SINGLE SOURCE OF TRUTH: This is the ONLY endpoint for MT5 data ingestion
  app.post("/api/mt5/sync", async (req, res) => {
    try {
      const { 
        userId, 
        token, 
        balance, 
        equity, 
        margin, 
        freeMargin, 
        marginLevel, 
        floatingPl, 
        leverage,
        currency,
        positions,
        history,
        accountNumber, // MT5 account login number
        broker,        // Broker name (optional)
        server         // MT5 server name (optional)
      } = req.body;

      if (!userId || !token) {
        return res.status(401).json({ message: "Authentication required: userId and token" });
      }

      // 1. Identification & Security Check
      const user = await storage.getUserRole(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found", error: "USER_NOT_FOUND" });
      }

      const storedToken = user.syncToken?.trim();
      const providedToken = token?.trim();

      // Enforce strict token validation (403 for mismatch)
      if (storedToken && storedToken !== providedToken) {
        console.warn(`[MT5 Sync] UNAUTHORIZED: Token mismatch for ${userId}.`);
        return res.status(403).json({ 
          message: "Invalid Sync Token.",
          error: "TOKEN_MISMATCH"
        });
      }

      // 2. MT5 Account Management - Create or update the account record
      const accountId = accountNumber ? String(accountNumber) : "default";
      if (accountNumber) {
        console.log(`[MT5 Sync] HEARTBEAT: Received data from ${userId} account ${accountId} at ${new Date().toISOString()}`);
        await storage.createMT5Account({
          userId,
          accountNumber: accountId,
          broker: broker || undefined,
          server: server || undefined,
          currency: currency || "USD",
        });
      } else {
        console.log(`[MT5 Sync] HEARTBEAT: Received data from ${userId} at ${new Date().toISOString()}`);
      }

      // 3. Atomic Sync Operation: Update metrics, snapshots, and history
      await storage.updateMT5Data({
        userId,
        syncToken: providedToken || "",
        balance: String(balance || 0),
        equity: String(equity || 0),
        margin: String(margin || 0),
        freeMargin: String(freeMargin || 0),
        marginLevel: String(marginLevel || 0),
        floatingPl: String(floatingPl || 0),
        leverage: leverage,
        currency: currency,
        positions: positions || [],
        mt5AccountId: accountId, // Associate with specific account
      });

      // 4. Update history with account association (Journal Data Integrity)
      if (history && Array.isArray(history) && history.length > 0) {
        console.log(`[MT5 Sync] Syncing history for ${userId} account ${accountId}. Count: ${history.length}`);
        await storage.syncMT5HistoryWithAccount(userId, accountId, history);
        
        await db.insert(schema.adminAuditLog).values({
          adminId: "SYSTEM_MT5",
          actionType: "MT5_HISTORY_SYNC",
          targetUserId: userId,
          details: { accountNumber: accountId, count: history.length, timestamp: new Date() }
        });
      }

      // 5. Auto-sync prop firm challenges linked to this MT5 account
      try {
        const linkedChallenges = await db.select().from(schema.propFirmChallenges)
          .where(and(
            eq(schema.propFirmChallenges.userId, userId),
            eq(schema.propFirmChallenges.mt5AccountId, accountId),
            eq(schema.propFirmChallenges.mt5AutoSync, true),
            eq(schema.propFirmChallenges.status, "active")
          ));

        if (linkedChallenges.length > 0) {
          const currentBalance = parseFloat(String(balance || 0));
          const currentEquity = parseFloat(String(equity || 0));
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Count today's closed trades from MT5 history
          let todayTradesCount = 0;
          let todayNetPl = 0;
          if (history && Array.isArray(history)) {
            for (const trade of history) {
              const closeTime = trade.closeTime ? new Date(trade.closeTime) : null;
              if (closeTime) {
                const closeDay = new Date(closeTime);
                closeDay.setHours(0, 0, 0, 0);
                if (closeDay.getTime() === today.getTime()) {
                  todayTradesCount++;
                  todayNetPl += parseFloat(trade.netPl || trade.grossPl || "0");
                }
              }
            }
          }

          for (const challenge of linkedChallenges) {
            // Check if we already have a daily stat for today
            const existingStats = await db.select().from(schema.propFirmDailyStats)
              .where(and(
                eq(schema.propFirmDailyStats.challengeId, challenge.id),
                eq(schema.propFirmDailyStats.userId, userId)
              ))
              .orderBy(desc(schema.propFirmDailyStats.date));

            const todayStat = existingStats.find(s => {
              const d = new Date(s.date);
              d.setHours(0, 0, 0, 0);
              return d.getTime() === today.getTime();
            });

            // Determine starting balance for today: use today's existing start, or yesterday's ending, or challenge's last known balance
            let dayStartBalance: number;
            if (todayStat) {
              dayStartBalance = parseFloat(todayStat.startingBalance);
            } else {
              // Use the most recent ending balance or the account size
              const lastStat = existingStats.length > 0 ? existingStats[0] : null;
              dayStartBalance = lastStat 
                ? parseFloat(lastStat.endingBalance) 
                : parseFloat(challenge.currentBalance || challenge.accountSize);
            }

            const dayPl = currentBalance - dayStartBalance;
            const newHWM = Math.max(
              parseFloat(challenge.highWaterMark || challenge.accountSize),
              currentBalance
            );

            if (todayStat) {
              // Update existing daily stat
              await db.update(schema.propFirmDailyStats)
                .set({
                  endingBalance: String(currentBalance),
                  dayPl: String(dayPl),
                  tradesCount: todayTradesCount,
                  dailyDrawdownUsed: String(Math.max(0, dayStartBalance - currentBalance)),
                  highWaterMark: String(newHWM),
                })
                .where(eq(schema.propFirmDailyStats.id, todayStat.id));
            } else if (todayTradesCount > 0 || Math.abs(dayPl) > 0.01) {
              // Create new daily stat only if there was trading activity
              await db.insert(schema.propFirmDailyStats).values({
                challengeId: challenge.id,
                userId,
                date: new Date(),
                startingBalance: String(dayStartBalance),
                endingBalance: String(currentBalance),
                dayPl: String(dayPl),
                tradesCount: todayTradesCount,
                dailyDrawdownUsed: String(Math.max(0, dayStartBalance - currentBalance)),
                highWaterMark: String(newHWM),
              });
            }

            // Update challenge balance and HWM
            await db.update(schema.propFirmChallenges)
              .set({
                currentBalance: String(currentBalance),
                highWaterMark: String(newHWM),
                updatedAt: new Date(),
              })
              .where(eq(schema.propFirmChallenges.id, challenge.id));
          }
          console.log(`[MT5 Sync] Auto-synced ${linkedChallenges.length} prop firm challenge(s) for ${userId}`);
        }
      } catch (propFirmErr) {
        console.error("[MT5 Sync] Prop firm auto-sync error (non-fatal):", propFirmErr);
      }

      res.json({ success: true, status: "CONNECTED", accountNumber: accountId, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error("[MT5 Sync Error]:", error);
      res.status(500).json({ message: "Synchronization failed" });
    }
  });

  app.get("/api/mt5/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const data = await storage.getMT5Data(userId);
      
      if (!data || !data.lastUpdate) {
        return res.json({ status: "OFFLINE", isLive: false });
      }
      
      const lastUpdate = new Date(data.lastUpdate);
      const now = new Date();
      // SINGLE SOURCE OF TRUTH: Status is CONNECTED only if sync was received within last 45 seconds
      const isLive = (now.getTime() - lastUpdate.getTime()) < 45000;
      
      res.json({
        status: isLive ? "CONNECTED" : "OFFLINE",
        lastSync: data.lastUpdate,
        isLive,
        metrics: {
          balance: data.balance,
          equity: data.equity,
          floatingPl: data.floatingPl,
          marginLevel: data.marginLevel,
          margin: data.margin,
          freeMargin: data.freeMargin,
          leverage: data.leverage,
          currency: data.currency,
          positions: data.positions
        }
      });
    } catch (error) {
      console.error("MT5 Status Error:", error);
      res.status(500).json({ message: "Failed to fetch status" });
    }
  });

  // MT5 Accounts Management Endpoints
  app.get("/api/mt5/accounts/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const accounts = await storage.getMT5Accounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("MT5 Accounts Error:", error);
      res.status(500).json({ message: "Failed to fetch MT5 accounts" });
    }
  });

  app.get("/api/mt5/accounts/:userId/active", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const activeAccount = await storage.getActiveMT5Account(userId);
      res.json(activeAccount || null);
    } catch (error) {
      console.error("MT5 Active Account Error:", error);
      res.status(500).json({ message: "Failed to fetch active MT5 account" });
    }
  });

  app.post("/api/mt5/accounts/:userId/switch", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { accountNumber } = req.body;
      const sessionUserId = req.session.userId!;
      
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!accountNumber) {
        return res.status(400).json({ message: "Account number is required" });
      }
      
      await storage.setActiveMT5Account(userId, accountNumber);
      const updatedAccount = await storage.getMT5Account(userId, accountNumber);
      
      res.json({ success: true, activeAccount: updatedAccount });
    } catch (error) {
      console.error("MT5 Switch Account Error:", error);
      res.status(500).json({ message: "Failed to switch MT5 account" });
    }
  });

  app.patch("/api/mt5/accounts/:userId/:accountNumber", requireAuth, async (req, res) => {
    try {
      const { userId, accountNumber } = req.params;
      const { accountName } = req.body;
      const sessionUserId = req.session.userId!;
      
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateMT5Account(userId, accountNumber, { accountName });
      res.json(updated);
    } catch (error) {
      console.error("MT5 Update Account Error:", error);
      res.status(500).json({ message: "Failed to update MT5 account" });
    }
  });

  app.delete("/api/mt5/accounts/:userId/:accountNumber", requireAuth, async (req, res) => {
    try {
      const { userId, accountNumber } = req.params;
      const sessionUserId = req.session.userId!;

      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const linkedChallenges = await db.select({ id: schema.propFirmChallenges.id })
        .from(schema.propFirmChallenges)
        .where(and(eq(schema.propFirmChallenges.userId, userId), eq(schema.propFirmChallenges.mt5AccountId, accountNumber)));

      if (linkedChallenges.length > 0) {
        const challengeIds = linkedChallenges.map(c => c.id);
        for (const cId of challengeIds) {
          await db.delete(schema.propFirmDailyStats)
            .where(and(eq(schema.propFirmDailyStats.challengeId, cId), eq(schema.propFirmDailyStats.userId, userId)));
        }
      }

      await db.delete(schema.mt5History)
        .where(and(eq(schema.mt5History.userId, userId), eq(schema.mt5History.mt5AccountId, accountNumber)));

      await db.delete(schema.dailyEquitySnapshots)
        .where(and(eq(schema.dailyEquitySnapshots.userId, userId), eq(schema.dailyEquitySnapshots.mt5AccountId, accountNumber)));

      await db.delete(schema.mt5Data)
        .where(and(eq(schema.mt5Data.userId, userId), eq(schema.mt5Data.mt5AccountId, accountNumber)));

      await db.delete(schema.mt5Accounts)
        .where(and(eq(schema.mt5Accounts.userId, userId), eq(schema.mt5Accounts.accountNumber, accountNumber)));

      await db.update(schema.propFirmChallenges)
        .set({ mt5AccountId: null, mt5AutoSync: false })
        .where(and(eq(schema.propFirmChallenges.userId, userId), eq(schema.propFirmChallenges.mt5AccountId, accountNumber)));

      res.json({ success: true, message: "Account and all associated data deleted" });
    } catch (error) {
      console.error("MT5 Delete Account Error:", error);
      res.status(500).json({ message: "Failed to delete MT5 account" });
    }
  });

  app.get("/api/mt5/snapshots/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const snapshots = await storage.getDailySnapshots(userId);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch snapshots" });
    }
  });

  // Equity curve from cumulative trade P&L (SINGLE SOURCE OF TRUTH)
  // Combines both MT5 history and manual trades (excluding MT5 duplicates)
  app.get("/api/equity-curve/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own equity curve" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      const allMt5History = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);
      const allManualTrades = await storage.getTrades(userId);
      
      // Apply tier-based date filtering
      const mt5History = filterByTierDate(allMt5History, historyDays);
      const manualTrades = filterByTierDate(allManualTrades, historyDays);
      
      // Combine MT5 history and manual trades (excluding MT5 sync duplicates)
      const mt5Trades = (mt5History || []).map(t => ({
        date: t.closeTime,
        netPl: parseFloat(t.netPl || "0"),
        symbol: t.symbol,
        source: "MT5"
      }));
      
      // Only include manual trades that are NOT MT5 sync duplicates
      const manualTradesFiltered = (manualTrades || [])
        .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
        .map(t => ({
          date: t.createdAt,
          netPl: parseFloat(t.netPl || "0"),
          symbol: t.pair,
          source: "Manual"
        }));
      
      const allTrades = [...mt5Trades, ...manualTradesFiltered];
      
      if (allTrades.length === 0) {
        return res.json([]);
      }

      // Sort trades chronologically
      const sortedTrades = allTrades.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate today's stats using UTC date matching (timestamps stored as UTC from Unix epochs)
      const todayUTC = new Date().toISOString().slice(0, 10);

      const todayTrades = sortedTrades.filter(t => {
        const d = new Date(t.date);
        return d.toISOString().slice(0, 10) === todayUTC;
      });
      const todayPl = todayTrades.reduce((sum, t) => sum + t.netPl, 0);
      const todayCount = todayTrades.length;
      console.log(`[Equity Curve] Total: ${sortedTrades.length} trades (MT5: ${mt5Trades.length}, Manual: ${manualTradesFiltered.length}), Active account: ${activeAccount?.accountNumber || 'none'}`);
      console.log(`[Equity Curve] Today (${todayUTC}): ${todayCount} trades, P&L: $${todayPl.toFixed(2)}`);

      // Calculate cumulative P&L
      let cumulativePl = 0;
      const equityCurve = sortedTrades.map(trade => {
        cumulativePl += trade.netPl;
        return {
          date: trade.date,
          equity: cumulativePl,
          netPl: trade.netPl,
          symbol: trade.symbol,
          source: trade.source
        };
      });

      res.json({ 
        trades: equityCurve, 
        todayStats: { pl: todayPl, count: todayCount } 
      });
    } catch (error) {
      console.error("Equity curve error:", error);
      res.status(500).json({ message: "Failed to generate equity curve" });
    }
  });

  app.get("/api/mt5/history/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      if (userId === "demo") {
        return res.json([]);
      }
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own MT5 history" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      const allHistory = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);
      const filteredHistory = filterByTierDate(allHistory, historyDays);
      res.json(filteredHistory);
    } catch (error) {
      console.error("MT5 History Error:", error);
      res.status(500).json({ message: "Failed to fetch MT5 history" });
    }
  });

  app.get("/api/performance/intelligence/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own performance data" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      
      // SINGLE SOURCE OF TRUTH: Combine MT5 history + manual trades (excluding duplicates)
      const allMt5History = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);
      const allManualTrades = await storage.getTrades(userId);
      
      // Apply tier-based date filtering
      const mt5History = filterByTierDate(allMt5History, historyDays);
      const manualTrades = filterByTierDate(allManualTrades, historyDays);
      
      // MT5 trades
      const mt5Normalized = (mt5History || []).map(t => {
        const pl = parseFloat(t.netPl || "0");
        return {
          netPl: pl,
          outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Break-even",
          direction: t.direction,
          createdAt: t.closeTime,
          riskReward: 0,
          setup: "MT5 Sync"
        };
      });
      
      // Manual trades (excluding MT5 sync duplicates)
      const manualNormalized = (manualTrades || [])
        .filter(t => !t.notes?.startsWith("MT5_TICKET_"))
        .map(t => ({
          netPl: parseFloat(t.netPl || "0"),
          outcome: t.outcome,
          direction: t.direction,
          createdAt: t.createdAt,
          riskReward: parseFloat(t.riskReward || "0"),
          setup: t.matchedSetup || "Manual Entry"
        }));
      
      const normalizedTrades = [...mt5Normalized, ...manualNormalized];

      if (normalizedTrades.length === 0) {
        return res.json({ message: "No data available" });
      }

      // Performance Intelligence Engine
      const sessions = { London: { pl: 0, wins: 0, total: 0 }, NY: { pl: 0, wins: 0, total: 0 }, Asia: { pl: 0, wins: 0, total: 0 } };
      const days = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      
      let totalPl = 0;
      let totalGrossProfit = 0;
      let totalGrossLoss = 0;
      let wins = 0;
      let losses = 0;
      let breakeven = 0;
      let totalTradesCount = normalizedTrades.length;
      let totalRR = 0;
      let rrCount = 0;
      let maxDrawdown = 0;
      let peak = 0;
      let currentEquity = 0;
      
      const setups: Record<string, { wins: number, total: number }> = {};
      const violations = {
        overRisk: 0,
        outsideSession: 0,
        noStrategy: 0,
        overtrading: 0
      };

      const dailyTrades: Record<string, number> = {};

      normalizedTrades.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()).forEach(t => {
        const date = new Date(t.createdAt!);
        const hour = date.getUTCHours();
        const day = dayNames[date.getUTCDay()];
        const dateStr = date.toISOString().split('T')[0];
        
        dailyTrades[dateStr] = (dailyTrades[dateStr] || 0) + 1;
        if (dailyTrades[dateStr] > 5) violations.overtrading++;

        const pl = t.netPl;
        totalPl += pl;
        if (pl > 0) totalGrossProfit += pl;
        else totalGrossLoss += Math.abs(pl);

        currentEquity += pl;
        if (currentEquity > peak) peak = currentEquity;
        const dd = peak - currentEquity;
        if (dd > maxDrawdown) maxDrawdown = dd;

        // Session classification (London: 8-16 UTC, NY: 13-21 UTC, Asia: 0-8 UTC)
        let session: "London" | "NY" | "Asia";
        if (hour >= 8 && hour < 13) session = "London"; // Pure London
        else if (hour >= 13 && hour < 16) session = "NY"; // London/NY Overlap (Classified as NY for intensity)
        else if (hour >= 16 && hour < 21) session = "NY"; // Pure NY
        else session = "Asia";

        sessions[session].pl += pl;
        sessions[session].total++;
        if (t.outcome === "Win") sessions[session].wins++;
        
        days[day as keyof typeof days] += pl;

        // Proper outcome classification
        if (pl > 0) wins++;
        else if (pl < 0) losses++;
        else breakeven++;

        if (t.riskReward > 0) {
          totalRR += t.riskReward;
          rrCount++;
        }

        if (hour < 8 || hour >= 21) violations.outsideSession++;
        if (t.setup === "Manual Entry") violations.noStrategy++;

        if (!setups[t.setup]) setups[t.setup] = { wins: 0, total: 0 };
        setups[t.setup].total++;
        if (t.outcome === "Win") setups[t.setup].wins++;
      });

      const bestSessionEntry = Object.entries(sessions).reduce((a, b) => a[1].pl > b[1].pl ? a : b);
      const bestSession = bestSessionEntry[0];
      const bestDay = Object.entries(days).reduce((a, b) => a[1] > b[1] ? a : b)[0];
      
      const setupStats = Object.entries(setups).map(([name, stat]) => ({
        name,
        winRate: (stat.wins / stat.total) * 100
      }));
      const bestSetup = setupStats.length ? setupStats.reduce((a, b) => a.winRate > b.winRate ? a : b).name : "N/A";

      const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0;
      
      // Win rate excludes break-even trades (only count decisive trades)
      const decisiveTrades = wins + losses;
      const winRateVal = decisiveTrades > 0 ? (wins / decisiveTrades) * 100 : 0;
      const lossRateVal = decisiveTrades > 0 ? (losses / decisiveTrades) * 100 : 0;
      
      // Average Win / Average Loss
      const avgWin = wins > 0 ? totalGrossProfit / wins : 0;
      const avgLoss = losses > 0 ? totalGrossLoss / losses : 0;
      
      // Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)
      const winRateDecimal = decisiveTrades > 0 ? wins / decisiveTrades : 0;
      const lossRateDecimal = decisiveTrades > 0 ? losses / decisiveTrades : 0;
      const expectancy = (winRateDecimal * avgWin) - (lossRateDecimal * avgLoss);
      
      const recoveryFactor = maxDrawdown > 0 ? totalPl / maxDrawdown : totalPl > 0 ? 1 : 0;

      res.json({
        bestSession,
        bestDay,
        bestSetup,
        winRate: winRateVal.toFixed(1),
        lossRate: lossRateVal.toFixed(1),
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        avgRR: rrCount ? (totalRR / rrCount).toFixed(2) : "0.00",
        expectancy: expectancy.toFixed(2),
        profitFactor: isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞",
        maxDrawdown: maxDrawdown.toFixed(2),
        maxDrawdownPercent: peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(2) : "0.00",
        recoveryFactor: recoveryFactor.toFixed(2),
        totalPl: totalPl.toFixed(2),
        totalTrades: totalTradesCount,
        wins,
        losses,
        breakeven,
        violations,
        sessionMetrics: sessions
      });
    } catch (error) {
      console.error("Intelligence failure:", error);
      res.status(500).json({ message: "Intelligence failure" });
    }
  });

  // Session Performance Analytics (ELITE ONLY)
  app.get("/api/session-analytics/:userId", requireAuth, async (req, res) => {
    // Prevent browser caching for dynamic analytics data
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    
    try {
      const { userId } = req.params;
      const { dateFilter, startDate, endDate } = req.query;
      
      // Elite tier check - get user from session and verify subscription
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own session analytics" });
      }
      
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Session Analytics requires Elite subscription" });
      }

      // Use shared UTC-based date filter
      const isWithinDateRange = (tradeDate: Date): boolean => {
        return isWithinDateRangeUTC(tradeDate, dateFilter as string, startDate as string, endDate as string);
      };

      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      const mt5History = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);

      // For session analytics, only use MT5 history trades since they have accurate open times.
      // Manual journal entries use created_at (sync time) which doesn't reflect actual trade time.
      type NormalizedTrade = {
        openTime: Date;
        closeTime: Date;
        netPl: number;
        volume: number;
        stopLoss: number | null;
        entryPrice: number | null;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        closeTime: new Date(t.closeTime),
        netPl: parseFloat(t.netPl || "0"),
        volume: parseFloat(t.volume || "0"),
        stopLoss: t.sl ? parseFloat(t.sl) : null,
        entryPrice: t.entryPrice ? parseFloat(t.entryPrice) : null,
      }));

      // Apply date filter to MT5 trades
      const allTrades = mt5Normalized.filter(trade => 
        isWithinDateRange(trade.openTime)
      );

      if (allTrades.length === 0) {
        return res.json({
          sessions: [],
          totalTrades: 0,
          bestSession: null,
          worstSession: null,
        });
      }

      // Use shared session classification (UTC-based)
      const classifySession = (date: Date): string => {
        const hour = date.getUTCHours();
        if (hour >= 0 && hour < 7) return "asian";
        if (hour >= 7 && hour < 12) return "london";
        if (hour >= 12 && hour < 16) return "overlap_london_ny";
        if (hour >= 16 && hour < 21) return "new_york";
        return "off_hours";
      };

      const sessionData: Record<string, {
        tradeCount: number;
        wins: number;
        losses: number;
        breakeven: number;
        totalPnL: number;
        totalVolume: number;
        totalRisk: number;
        riskCount: number;
      }> = {
        asian: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        london: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        overlap_london_ny: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        new_york: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
        off_hours: { tradeCount: 0, wins: 0, losses: 0, breakeven: 0, totalPnL: 0, totalVolume: 0, totalRisk: 0, riskCount: 0 },
      };

      allTrades.forEach(trade => {
        const session = classifySession(trade.openTime);
        const data = sessionData[session];
        
        data.tradeCount++;
        data.totalPnL += trade.netPl;
        data.totalVolume += trade.volume;
        
        if (trade.netPl > 0) data.wins++;
        else if (trade.netPl < 0) data.losses++;
        else data.breakeven++;

        // Calculate risk if stop loss and entry price available
        if (trade.stopLoss && trade.entryPrice) {
          const risk = Math.abs(trade.entryPrice - trade.stopLoss);
          data.totalRisk += risk;
          data.riskCount++;
        }
      });

      const sessionInfo: Record<string, { displayName: string; color: string }> = {
        asian: { displayName: "Asian", color: "#f59e0b" },
        london: { displayName: "London", color: "#3b82f6" },
        overlap_london_ny: { displayName: "London/NY Overlap", color: "#8b5cf6" },
        new_york: { displayName: "New York", color: "#10b981" },
        off_hours: { displayName: "Off Hours", color: "#6b7280" },
      };

      const sessions = Object.entries(sessionData)
        .filter(([_, data]) => data.tradeCount > 0)
        .map(([session, data]) => {
          const decisiveTrades = data.wins + data.losses;
          return {
            session,
            displayName: sessionInfo[session].displayName,
            color: sessionInfo[session].color,
            tradeCount: data.tradeCount,
            winCount: data.wins,
            lossCount: data.losses,
            breakEvenCount: data.breakeven,
            winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
            totalPnL: data.totalPnL,
            avgPnL: data.tradeCount > 0 ? data.totalPnL / data.tradeCount : 0,
            avgRisk: data.riskCount > 0 ? data.totalRisk / data.riskCount : 0,
            totalVolume: data.totalVolume,
          };
        })
        .sort((a, b) => b.tradeCount - a.tradeCount);

      // Find best and worst sessions by P&L
      let bestSession = null;
      let worstSession = null;
      if (sessions.length > 0) {
        const sortedByPnL = [...sessions].sort((a, b) => b.totalPnL - a.totalPnL);
        bestSession = sortedByPnL[0]?.session || null;
        worstSession = sortedByPnL[sortedByPnL.length - 1]?.session || null;
      }

      res.json({
        sessions,
        totalTrades: allTrades.length,
        bestSession,
        worstSession,
      });
    } catch (error) {
      console.error("Session analytics failure:", error);
      res.status(500).json({ message: "Session analytics failure" });
    }
  });

  // Time-Based Performance Analysis (ELITE ONLY)
  app.get("/api/time-patterns/:userId", requireAuth, async (req, res) => {
    // Prevent browser caching for dynamic analytics data
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    
    try {
      const { userId } = req.params;
      const { dateFilter, startDate, endDate } = req.query;
      
      // Elite tier check - get user from session and verify subscription
      const sessionUserId = req.session.userId!;
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own time patterns" });
      }
      
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Time Patterns requires Elite subscription" });
      }

      // Use shared UTC-based date filter
      const isWithinDateRange = (tradeDate: Date): boolean => {
        return isWithinDateRangeUTC(tradeDate, dateFilter as string, startDate as string, endDate as string);
      };

      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      const mt5History = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);

      // For time patterns, only use MT5 history trades since they have accurate open times.
      // Manual journal entries use created_at (sync time) which doesn't reflect actual trade time.
      type NormalizedTrade = {
        openTime: Date;
        netPl: number;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        netPl: parseFloat(t.netPl || "0"),
      }));

      // Apply date filter to MT5 trades
      const allTrades = mt5Normalized.filter(trade => 
        isWithinDateRange(trade.openTime)
      );

      if (allTrades.length === 0) {
        return res.json({
          byDayOfWeek: [],
          byHourOfDay: [],
          totalTrades: 0,
          bestDay: null,
          worstDay: null,
          bestHour: null,
          worstHour: null,
        });
      }

      // Day of week analysis (0 = Sunday, 6 = Saturday)
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayData: Record<number, { trades: number; wins: number; losses: number; pnl: number }> = {};
      for (let i = 0; i < 7; i++) {
        dayData[i] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
      }

      // Hour of day analysis (0-23 UTC)
      const hourData: Record<number, { trades: number; wins: number; losses: number; pnl: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourData[i] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
      }

      allTrades.forEach(trade => {
        const day = trade.openTime.getUTCDay();
        const hour = trade.openTime.getUTCHours();

        // Day stats
        dayData[day].trades++;
        dayData[day].pnl += trade.netPl;
        if (trade.netPl > 0) dayData[day].wins++;
        else if (trade.netPl < 0) dayData[day].losses++;

        // Hour stats
        hourData[hour].trades++;
        hourData[hour].pnl += trade.netPl;
        if (trade.netPl > 0) hourData[hour].wins++;
        else if (trade.netPl < 0) hourData[hour].losses++;
      });

      // Format day data
      const byDayOfWeek = Object.entries(dayData).map(([day, data]) => {
        const decisiveTrades = data.wins + data.losses;
        return {
          day: parseInt(day),
          dayName: dayNames[parseInt(day)],
          trades: data.trades,
          wins: data.wins,
          losses: data.losses,
          winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
          pnl: data.pnl,
          avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
        };
      });

      // Format hour data
      const byHourOfDay = Object.entries(hourData).map(([hour, data]) => {
        const decisiveTrades = data.wins + data.losses;
        const hourNum = parseInt(hour);
        return {
          hour: hourNum,
          hourLabel: `${hourNum.toString().padStart(2, '0')}:00`,
          trades: data.trades,
          wins: data.wins,
          losses: data.losses,
          winRate: decisiveTrades > 0 ? (data.wins / decisiveTrades) * 100 : 0,
          pnl: data.pnl,
          avgPnl: data.trades > 0 ? data.pnl / data.trades : 0,
        };
      });

      // Find best/worst by P&L (only consider days/hours with trades)
      const activeDays = byDayOfWeek.filter(d => d.trades > 0);
      const activeHours = byHourOfDay.filter(h => h.trades > 0);

      let bestDay = null, worstDay = null, bestHour = null, worstHour = null;

      if (activeDays.length > 0) {
        const sortedDays = [...activeDays].sort((a, b) => b.pnl - a.pnl);
        bestDay = sortedDays[0].dayName;
        worstDay = sortedDays[sortedDays.length - 1].dayName;
      }

      if (activeHours.length > 0) {
        const sortedHours = [...activeHours].sort((a, b) => b.pnl - a.pnl);
        bestHour = sortedHours[0].hourLabel;
        worstHour = sortedHours[sortedHours.length - 1].hourLabel;
      }

      res.json({
        byDayOfWeek,
        byHourOfDay,
        totalTrades: allTrades.length,
        bestDay,
        worstDay,
        bestHour,
        worstHour,
      });
    } catch (error) {
      console.error("Time patterns analysis failure:", error);
      res.status(500).json({ message: "Time patterns analysis failure" });
    }
  });

  // Behavioral Risk Flags (ELITE ONLY)
  app.get("/api/behavioral-risks/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId!;
      const period = (req.query.period as string) || "all";
      
      // Access control: ensure user can only access their own data
      if (userId !== sessionUserId) {
        return res.status(403).json({ message: "Access denied: Can only view your own behavioral risks" });
      }
      
      // Elite tier check
      const currentUser = await storage.getUserRole(sessionUserId);
      const tier = currentUser?.subscriptionTier?.toUpperCase();
      if (tier !== "ELITE") {
        return res.status(403).json({ message: "Behavioral Risk Flags requires Elite subscription" });
      }

      // Get active MT5 account and filter history accordingly
      const activeAccount = await storage.getActiveMT5Account(userId);
      const mt5History = activeAccount 
        ? await storage.getMT5HistoryByAccount(userId, activeAccount.accountNumber)
        : await storage.getMT5History(userId);
      const manualTrades = await storage.getTrades(userId);

      // Normalize trades from both sources
      type NormalizedTrade = {
        openTime: Date;
        closeTime: Date;
        netPl: number;
        volume: number;
        symbol: string;
      };

      const mt5Normalized: NormalizedTrade[] = (mt5History || []).map(t => ({
        openTime: new Date(t.openTime),
        closeTime: new Date(t.closeTime),
        netPl: parseFloat(t.netPl || "0"),
        volume: parseFloat(t.volume || "0"),
        symbol: t.symbol || "Unknown",
      }));

      // For volume-based analysis, only use MT5 trades (manual trades don't have lot size)
      let mt5OnlyTrades = mt5Normalized.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
      
      // For general analysis (frequency, timing), include all trades
      const manualNormalized: NormalizedTrade[] = (manualTrades || [])
        .map(t => ({
          openTime: new Date(t.createdAt!),
          closeTime: new Date(t.createdAt!),
          netPl: parseFloat(t.netPl || "0"),
          volume: 0,
          symbol: t.pair || "Unknown",
        }));

      let allTrades = [...mt5Normalized, ...manualNormalized]
        .sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());

      // Apply date filtering based on period (UTC-based for consistency)
      if (period !== "all") {
        const now = new Date();
        let cutoff: Date;
        if (period === "today") {
          cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        } else if (period === "7d") {
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === "30d") {
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (period === "month") {
          cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        } else {
          cutoff = new Date(0);
        }
        allTrades = allTrades.filter(t => t.closeTime >= cutoff);
        mt5OnlyTrades = mt5OnlyTrades.filter(t => t.closeTime >= cutoff);
      }

      if (allTrades.length < 5) {
        return res.json({
          flags: [],
          summary: { totalFlags: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 },
          message: "Insufficient trade data. At least 5 trades required for behavioral analysis."
        });
      }

      const flags: Array<{
        type: string;
        severity: "high" | "medium" | "low";
        title: string;
        description: string;
        evidence: string;
        period?: string;
      }> = [];

      // 1. REVENGE TRADING DETECTION (MT5 only - requires position sizes)
      // Pattern: Increased position size on the NEXT trade after consecutive losses
      if (mt5OnlyTrades.length >= 10) {
        let consecutiveLosses = 0;
        let revengeTradeCount = 0;
        let totalPostLossVolumeIncrease = 0;
        let previousVolume = mt5OnlyTrades[0]?.volume || 0;

        for (let i = 1; i < mt5OnlyTrades.length; i++) {
          const prevTrade = mt5OnlyTrades[i - 1];
          const currentTrade = mt5OnlyTrades[i];
          
          if (prevTrade.netPl < 0) {
            consecutiveLosses++;
          } else {
            consecutiveLosses = 0;
          }
          
          // Check if NEXT trade after 2+ losses has increased volume
          if (consecutiveLosses >= 2 && previousVolume > 0) {
            if (currentTrade.volume > previousVolume * 1.3) {
              revengeTradeCount++;
              totalPostLossVolumeIncrease += (currentTrade.volume - previousVolume) / previousVolume * 100;
            }
          }
          
          previousVolume = currentTrade.volume;
        }

        if (revengeTradeCount > 0) {
          const avgIncrease = totalPostLossVolumeIncrease / revengeTradeCount;
          const severity = revengeTradeCount >= 5 ? "high" : revengeTradeCount >= 2 ? "medium" : "low";
          flags.push({
            type: "revenge_trading",
            severity,
            title: "Increased Risk After Losses",
            description: "Position sizes tend to increase following consecutive losing trades.",
            evidence: `Detected ${revengeTradeCount} instances where volume increased by avg ${avgIncrease.toFixed(1)}% after 2+ losses (MT5 trades).`,
          });
        }
      }

      // 2. OVERTRADING DETECTION BY SESSION
      // Group trades by session and detect abnormal trade frequency
      const sessionTradeCounts: Record<string, { dates: Set<string>, trades: number }> = {};
      
      for (const trade of allTrades) {
        const utcHour = trade.openTime.getUTCHours();
        let session = "off_hours";
        if (utcHour >= 0 && utcHour < 7) session = "asian";
        else if (utcHour >= 7 && utcHour < 12) session = "london";
        else if (utcHour >= 12 && utcHour < 16) session = "overlap";
        else if (utcHour >= 16 && utcHour < 21) session = "new_york";
        
        const dateKey = trade.openTime.toISOString().split('T')[0];
        if (!sessionTradeCounts[session]) {
          sessionTradeCounts[session] = { dates: new Set(), trades: 0 };
        }
        sessionTradeCounts[session].dates.add(dateKey);
        sessionTradeCounts[session].trades++;
      }

      const sessionAverages: Record<string, number> = {};
      for (const [session, data] of Object.entries(sessionTradeCounts)) {
        sessionAverages[session] = data.trades / Math.max(1, data.dates.size);
      }

      const overallAvg = Object.values(sessionAverages).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(sessionAverages).length);
      
      for (const [session, avg] of Object.entries(sessionAverages)) {
        if (avg > overallAvg * 1.8 && sessionTradeCounts[session].trades >= 10) {
          const sessionName = session.charAt(0).toUpperCase() + session.slice(1).replace('_', ' ');
          flags.push({
            type: "session_overtrading",
            severity: avg > overallAvg * 2.5 ? "high" : "medium",
            title: `Elevated Trading in ${sessionName} Session`,
            description: `Trade frequency in the ${sessionName} session is significantly higher than other sessions.`,
            evidence: `${avg.toFixed(1)} trades/day in ${sessionName} vs ${overallAvg.toFixed(1)} trades/day average across sessions.`,
          });
        }
      }

      // 3. RISK CREEP OVER TIME (MT5 only - requires position sizes)
      // Detect gradual increase in position sizes over time
      if (mt5OnlyTrades.length >= 20) {
        const firstQuarterTrades = mt5OnlyTrades.slice(0, Math.floor(mt5OnlyTrades.length / 4));
        const lastQuarterTrades = mt5OnlyTrades.slice(-Math.floor(mt5OnlyTrades.length / 4));
        
        const firstQuarterAvgVolume = firstQuarterTrades.reduce((a, t) => a + t.volume, 0) / firstQuarterTrades.length;
        const lastQuarterAvgVolume = lastQuarterTrades.reduce((a, t) => a + t.volume, 0) / lastQuarterTrades.length;
        
        if (firstQuarterAvgVolume > 0 && lastQuarterAvgVolume > firstQuarterAvgVolume * 1.25) {
          const increasePercent = ((lastQuarterAvgVolume - firstQuarterAvgVolume) / firstQuarterAvgVolume) * 100;
          const firstDate = firstQuarterTrades[0].openTime.toISOString().split('T')[0];
          const lastDate = lastQuarterTrades[lastQuarterTrades.length - 1].openTime.toISOString().split('T')[0];
          
          flags.push({
            type: "risk_creep",
            severity: increasePercent > 75 ? "high" : increasePercent > 40 ? "medium" : "low",
            title: "Position Size Increase Over Time",
            description: "Average position sizes have increased compared to earlier trading period.",
            evidence: `Volume increased ${increasePercent.toFixed(1)}% from early period (avg ${firstQuarterAvgVolume.toFixed(2)}) to recent (avg ${lastQuarterAvgVolume.toFixed(2)}) (MT5 trades).`,
            period: `${firstDate} to ${lastDate}`,
          });
        }
      }

      // 4. RAPID TRADING AFTER LOSSES (Same-day revenge)
      const dailyTrades: Record<string, NormalizedTrade[]> = {};
      for (const trade of allTrades) {
        const dateKey = trade.closeTime.toISOString().split('T')[0];
        if (!dailyTrades[dateKey]) dailyTrades[dateKey] = [];
        dailyTrades[dateKey].push(trade);
      }

      let rapidRetryDays = 0;
      for (const [date, trades] of Object.entries(dailyTrades)) {
        if (trades.length < 3) continue;
        
        // Sort trades by time
        trades.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
        
        // Check for rapid trading after losses (multiple trades within 30 mins after a loss)
        for (let i = 0; i < trades.length - 1; i++) {
          if (trades[i].netPl < 0) {
            const nextTrade = trades[i + 1];
            const timeDiff = (nextTrade.openTime.getTime() - trades[i].closeTime.getTime()) / (1000 * 60);
            if (timeDiff < 15) {
              rapidRetryDays++;
              break;
            }
          }
        }
      }

      if (rapidRetryDays >= 3) {
        flags.push({
          type: "rapid_retry",
          severity: rapidRetryDays >= 7 ? "high" : "medium",
          title: "Quick Re-Entry After Losses",
          description: "New trades are often opened within minutes after losing trades close.",
          evidence: `Found ${rapidRetryDays} days where new trades were opened within 15 minutes of a loss.`,
        });
      }

      // 5. LOSS CHASING (Increasing volume on losing days - MT5 only)
      if (mt5OnlyTrades.length >= 10) {
        const mt5DailyTrades: Record<string, NormalizedTrade[]> = {};
        for (const trade of mt5OnlyTrades) {
          const dateKey = trade.closeTime.toISOString().split('T')[0];
          if (!mt5DailyTrades[dateKey]) mt5DailyTrades[dateKey] = [];
          mt5DailyTrades[dateKey].push(trade);
        }

        let lossChasingDays = 0;
        for (const [date, trades] of Object.entries(mt5DailyTrades)) {
          if (trades.length < 3) continue;
          
          trades.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
          
          let runningPnL = 0;
          let increasedVolumeAfterLoss = false;
          let prevVolume = trades[0].volume;
          
          for (let i = 0; i < trades.length; i++) {
            runningPnL += trades[i].netPl;
            if (runningPnL < 0 && trades[i].volume > prevVolume * 1.3) {
              increasedVolumeAfterLoss = true;
            }
            prevVolume = trades[i].volume;
          }
          
          if (increasedVolumeAfterLoss && runningPnL < 0) {
            lossChasingDays++;
          }
        }

        if (lossChasingDays >= 2) {
          flags.push({
            type: "loss_chasing",
            severity: lossChasingDays >= 5 ? "high" : "medium",
            title: "Increased Size on Losing Days",
            description: "Position sizes increased during days that ended with negative P&L.",
            evidence: `Detected ${lossChasingDays} losing days where volume increased mid-session while down (MT5 trades).`,
          });
        }
      }

      // Calculate summary
      const summary = {
        totalFlags: flags.length,
        highRisk: flags.filter(f => f.severity === "high").length,
        mediumRisk: flags.filter(f => f.severity === "medium").length,
        lowRisk: flags.filter(f => f.severity === "low").length,
      };

      // Historical comparison - compare recent 30 days to prior 30 days
      // Use MT5 trades for volume comparison, all trades for frequency
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      
      const recentTrades = allTrades.filter(t => t.closeTime >= thirtyDaysAgo);
      const priorTrades = allTrades.filter(t => t.closeTime >= sixtyDaysAgo && t.closeTime < thirtyDaysAgo);
      const recentMt5Trades = mt5OnlyTrades.filter(t => t.closeTime >= thirtyDaysAgo);
      const priorMt5Trades = mt5OnlyTrades.filter(t => t.closeTime >= sixtyDaysAgo && t.closeTime < thirtyDaysAgo);

      let historicalComparison = null;
      if (recentTrades.length >= 5 && priorTrades.length >= 5) {
        const recentAvgVolume = recentMt5Trades.length > 0 ? recentMt5Trades.reduce((a, t) => a + t.volume, 0) / recentMt5Trades.length : 0;
        const priorAvgVolume = priorMt5Trades.length > 0 ? priorMt5Trades.reduce((a, t) => a + t.volume, 0) / priorMt5Trades.length : 0;
        const recentTradesPerDay = recentTrades.length / 30;
        const priorTradesPerDay = priorTrades.length / 30;
        
        historicalComparison = {
          recentPeriod: "Last 30 days",
          priorPeriod: "30-60 days ago",
          volumeChange: priorAvgVolume > 0 ? ((recentAvgVolume - priorAvgVolume) / priorAvgVolume * 100).toFixed(1) : "N/A",
          frequencyChange: priorTradesPerDay > 0 ? ((recentTradesPerDay - priorTradesPerDay) / priorTradesPerDay * 100).toFixed(1) : "0",
          recentTradeCount: recentTrades.length,
          priorTradeCount: priorTrades.length,
        };
      }

      res.json({
        flags: flags.sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        }),
        summary,
        historicalComparison,
        analyzedTrades: allTrades.length,
      });
    } catch (error) {
      console.error("Behavioral risk analysis failure:", error);
      res.status(500).json({ message: "Behavioral risk analysis failure" });
    }
  });

  // STRATEGY DEVIATION ANALYSIS - Elite only
  // Compare compliant vs non-compliant trade performance
  app.get("/api/strategy-deviation/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verify user access
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Elite tier check
      const user = await storage.getUserRole(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!canAccessFeature(user.subscriptionTier || "FREE", "sessionAnalytics")) {
        return res.status(403).json({ 
          message: "Elite subscription required for Strategy Deviation Analysis",
          requiredTier: "ELITE"
        });
      }

      // Get all compliance results for this user
      const complianceResults = await db
        .select()
        .from(schema.tradeComplianceResults)
        .where(eq(schema.tradeComplianceResults.userId, userId));

      if (complianceResults.length === 0) {
        return res.json({
          message: "No strategy validation data found. Validate trades against your strategies to see deviation analysis.",
          hasData: false,
        });
      }

      // Get manual trades for P&L lookup
      // Note: Strategy Validator currently only evaluates manual trades (trade_journal),
      // so compliance results reference trade_journal IDs. MT5 trades are not evaluated.
      const manualTrades = await storage.getTrades(userId);
      
      // Build trade P&L lookup from manual trades
      const tradePnL: Record<number, number> = {};
      for (const trade of manualTrades) {
        tradePnL[trade.id] = parseFloat(trade.netPl || "0");
      }
      
      // Group compliance results
      const compliantResults = complianceResults.filter(cr => cr.overallCompliant);
      const nonCompliantResults = complianceResults.filter(cr => !cr.overallCompliant);
      
      // Calculate P&L for each group
      let compliantPnL = 0;
      let compliantWins = 0;
      let compliantCount = 0;
      
      let nonCompliantPnL = 0;
      let nonCompliantWins = 0;
      let nonCompliantCount = 0;
      
      for (const cr of compliantResults) {
        const pnl = tradePnL[cr.tradeId];
        if (pnl !== undefined) {
          compliantPnL += pnl;
          if (pnl > 0) compliantWins++;
          compliantCount++;
        }
      }
      
      for (const cr of nonCompliantResults) {
        const pnl = tradePnL[cr.tradeId];
        if (pnl !== undefined) {
          nonCompliantPnL += pnl;
          if (pnl > 0) nonCompliantWins++;
          nonCompliantCount++;
        }
      }
      
      // Get all rule evaluations for failed rules
      const allComplianceIds = complianceResults.map(cr => cr.id);
      const ruleEvaluations = allComplianceIds.length > 0 
        ? await db
            .select()
            .from(schema.tradeRuleEvaluations)
            .where(sql`${schema.tradeRuleEvaluations.complianceResultId} IN (${sql.join(allComplianceIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      
      // Count violations by rule type
      const violationCounts: Record<string, { label: string; count: number; trades: number[] }> = {};
      
      for (const evaluation of ruleEvaluations) {
        if (!evaluation.passed) {
          if (!violationCounts[evaluation.ruleType]) {
            violationCounts[evaluation.ruleType] = {
              label: evaluation.ruleLabel,
              count: 0,
              trades: [],
            };
          }
          violationCounts[evaluation.ruleType].count++;
          // Find the trade ID from the compliance result
          const cr = complianceResults.find(c => c.id === evaluation.complianceResultId);
          if (cr && !violationCounts[evaluation.ruleType].trades.includes(cr.tradeId)) {
            violationCounts[evaluation.ruleType].trades.push(cr.tradeId);
          }
        }
      }
      
      // Sort violations by count
      const mostViolatedRules = Object.entries(violationCounts)
        .map(([ruleType, data]) => ({
          ruleType,
          ruleLabel: data.label,
          violationCount: data.count,
          affectedTrades: data.trades.length,
        }))
        .sort((a, b) => b.violationCount - a.violationCount)
        .slice(0, 10);
      
      // Calculate performance impact for most violated rules
      const rulePerformanceImpact: Array<{
        ruleType: string;
        ruleLabel: string;
        tradesViolating: number;
        avgPnLWhenViolated: number;
        avgPnLWhenCompliant: number;
        performanceDifference: number;
      }> = [];
      
      for (const violation of mostViolatedRules.slice(0, 5)) {
        // Get compliance result IDs where this rule was violated
        const violatedCrIds = ruleEvaluations
          .filter(e => e.ruleType === violation.ruleType && !e.passed)
          .map(e => e.complianceResultId);
        
        // Get trade IDs from these compliance results
        const violatedTradeIds = complianceResults
          .filter(cr => violatedCrIds.includes(cr.id))
          .map(cr => cr.tradeId);
        
        // Get all compliance result IDs where this rule was checked
        const checkedCrIds = ruleEvaluations
          .filter(e => e.ruleType === violation.ruleType)
          .map(e => e.complianceResultId);
        
        // Get passed trade IDs
        const passedCrIds = ruleEvaluations
          .filter(e => e.ruleType === violation.ruleType && e.passed)
          .map(e => e.complianceResultId);
        
        const passedTradeIds = complianceResults
          .filter(cr => passedCrIds.includes(cr.id))
          .map(cr => cr.tradeId);
        
        // Calculate P&L
        let violatedPnL = 0;
        let violatedCount = 0;
        let passedPnL = 0;
        let passedCount = 0;
        
        for (const tradeId of violatedTradeIds) {
          const pnl = tradePnL[tradeId];
          if (pnl !== undefined) {
            violatedPnL += pnl;
            violatedCount++;
          }
        }
        
        for (const tradeId of passedTradeIds) {
          const pnl = tradePnL[tradeId];
          if (pnl !== undefined) {
            passedPnL += pnl;
            passedCount++;
          }
        }
        
        const avgViolated = violatedCount > 0 ? violatedPnL / violatedCount : 0;
        const avgPassed = passedCount > 0 ? passedPnL / passedCount : 0;
        
        rulePerformanceImpact.push({
          ruleType: violation.ruleType,
          ruleLabel: violation.ruleLabel,
          tradesViolating: violatedCount,
          avgPnLWhenViolated: avgViolated,
          avgPnLWhenCompliant: avgPassed,
          performanceDifference: avgPassed - avgViolated,
        });
      }
      
      // Strategy breakdown
      const strategyStats: Record<number, {
        strategyId: number;
        strategyName: string;
        totalEvaluated: number;
        compliantCount: number;
        nonCompliantCount: number;
        complianceRate: number;
        compliantPnL: number;
        nonCompliantPnL: number;
      }> = {};
      
      for (const cr of complianceResults) {
        if (!strategyStats[cr.strategyId]) {
          strategyStats[cr.strategyId] = {
            strategyId: cr.strategyId,
            strategyName: cr.strategyName,
            totalEvaluated: 0,
            compliantCount: 0,
            nonCompliantCount: 0,
            complianceRate: 0,
            compliantPnL: 0,
            nonCompliantPnL: 0,
          };
        }
        
        strategyStats[cr.strategyId].totalEvaluated++;
        const pnl = tradePnL[cr.tradeId] || 0;
        
        if (cr.overallCompliant) {
          strategyStats[cr.strategyId].compliantCount++;
          strategyStats[cr.strategyId].compliantPnL += pnl;
        } else {
          strategyStats[cr.strategyId].nonCompliantCount++;
          strategyStats[cr.strategyId].nonCompliantPnL += pnl;
        }
      }
      
      // Calculate compliance rates
      for (const stats of Object.values(strategyStats)) {
        stats.complianceRate = stats.totalEvaluated > 0 
          ? (stats.compliantCount / stats.totalEvaluated) * 100 
          : 0;
      }
      
      const strategyBreakdown = Object.values(strategyStats)
        .sort((a, b) => b.totalEvaluated - a.totalEvaluated);
      
      res.json({
        hasData: true,
        summary: {
          totalEvaluatedTrades: complianceResults.length,
          compliantTrades: {
            count: compliantCount,
            totalPnL: compliantPnL,
            avgPnL: compliantCount > 0 ? compliantPnL / compliantCount : 0,
            winRate: compliantCount > 0 ? (compliantWins / compliantCount) * 100 : 0,
          },
          nonCompliantTrades: {
            count: nonCompliantCount,
            totalPnL: nonCompliantPnL,
            avgPnL: nonCompliantCount > 0 ? nonCompliantPnL / nonCompliantCount : 0,
            winRate: nonCompliantCount > 0 ? (nonCompliantWins / nonCompliantCount) * 100 : 0,
          },
          performanceDifference: {
            pnlDifference: compliantPnL - nonCompliantPnL,
            avgPnLDifference: 
              (compliantCount > 0 ? compliantPnL / compliantCount : 0) - 
              (nonCompliantCount > 0 ? nonCompliantPnL / nonCompliantCount : 0),
            winRateDifference: 
              (compliantCount > 0 ? (compliantWins / compliantCount) * 100 : 0) - 
              (nonCompliantCount > 0 ? (nonCompliantWins / nonCompliantCount) * 100 : 0),
          },
          overallComplianceRate: complianceResults.length > 0 
            ? (compliantResults.length / complianceResults.length) * 100 
            : 0,
        },
        mostViolatedRules,
        rulePerformanceImpact,
        strategyBreakdown,
      });
    } catch (error) {
      console.error("Strategy deviation analysis failure:", error);
      res.status(500).json({ message: "Strategy deviation analysis failure" });
    }
  });

  app.get("/api/ai/insights/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { timeframe = "recent" } = req.query;

      // Check for existing recent insight (cache for 1 hour)
      const existing = await storage.getAIInsights(userId, timeframe as string);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (existing.length > 0 && new Date(existing[0].createdAt!) > oneHourAgo) {
        return res.json(existing[0]);
      }

      // Generate new insight
      const intelligenceRes = await fetch(`${req.protocol}://${req.get('host')}/api/performance/intelligence/${userId}`, {
        headers: { cookie: req.headers.cookie || "" }
      });
      const intelligenceData = await intelligenceRes.json();

      if (intelligenceData.message === "No data available" || (intelligenceData.totalTrades || 0) < 5) {
        return res.json({ insightText: "Insufficient data for AI analysis. Continue trading to unlock insights." });
      }

      const prompt = `You are a Performance Analyst for a rule-based trading application. 
Analyze the following trading metrics and provide 1-3 short, factual, and non-advisory insights.
Strict Rules:
- Descriptive and factual ONLY.
- NO trade recommendations.
- NO buy/sell suggestions.
- NO entries, SL, or TP instructions.
- NO symbol or timeframe recommendations.
- NO market predictions.
- MUST label output as "PERFORMANCE INSIGHT".
- MUST include the disclaimer: "This is not financial advice."

Metrics:
- Total Trades: ${intelligenceData.totalTrades}
- Win Rate: ${intelligenceData.winRate}%
- Profit Factor: ${intelligenceData.profitFactor}
- Expectancy: ${intelligenceData.expectancy}
- Best Session: ${intelligenceData.bestSession}
- Violations: ${JSON.stringify(intelligenceData.violations)}

Output exactly 1-3 bullet points.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      });

      const insightText = response.choices[0].message.content || "Unable to generate insights at this time.";
      
      const disclaimer = "\n\nThis is not financial advice.";
      const finalInsight = insightText.includes("This is not financial advice") ? insightText : insightText + disclaimer;

      const savedInsight = await storage.saveAIInsight({
        userId,
        timeframe: timeframe as string,
        insightText: finalInsight,
        metadata: intelligenceData
      });

      await storage.logAIRequest({
        userId,
        prompt,
        response: insightText
      });

      res.json(savedInsight);
    } catch (error) {
      console.error("AI Insight Error:", error);
      res.status(500).json({ message: "AI Analysis failed" });
    }
  });

  // ENHANCED AI PSYCHOLOGY REVIEW - Pro+ feature
  // Analyzes trading psychology patterns: mood-outcome correlations, mistake impact
  app.get("/api/ai/psychology-review/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { period = "30", force } = req.query;

      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUserRole(userId);
      if (!user || !canAccessFeature(user.subscriptionTier || "FREE", "aiAnalysis")) {
        return res.status(403).json({
          message: "Pro subscription required for Psychology Review",
          requiredTier: "PRO"
        });
      }

      const cacheKey = `psychology-review-${period}d`;
      const forceRefresh = force === "1" || force === "true";
      if (!forceRefresh) {
        const existing = await storage.getAIInsights(userId, cacheKey);
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        if (existing.length > 0 && new Date(existing[0].createdAt!) > sixHoursAgo) {
          return res.json({ ...existing[0], cached: true });
        }
      }

      const periodDays = parseInt(period as string) || 30;
      const cutoffDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const mt5Trades = await db.select()
        .from(schema.mt5History)
        .where(and(
          eq(schema.mt5History.userId, userId),
          sql`${schema.mt5History.closeTime} >= ${cutoffDate}`
        ));

      const manualTrades = (await storage.getTrades(userId))
        .filter(t => t.createdAt && new Date(t.createdAt) >= cutoffDate);

      const allTrades = [
        ...mt5Trades.map(t => ({
          pnl: parseFloat(t.netPl),
          outcome: parseFloat(t.netPl) > 0 ? "Win" : parseFloat(t.netPl) < 0 ? "Loss" : "Break-even",
          symbol: t.symbol,
          direction: t.direction,
          mood: t.mood || null,
          mistakeCategory: t.mistakeCategory || null,
          source: "MT5",
        })),
        ...manualTrades.filter(t => !t.notes?.startsWith("MT5_TICKET_")).map(t => ({
          pnl: parseFloat(t.netPl || "0"),
          outcome: t.outcome,
          symbol: t.pair,
          direction: t.direction,
          mood: t.mood || null,
          mistakeCategory: t.mistakeCategory || null,
          source: "Manual",
        })),
      ];

      if (allTrades.length < 5) {
        return res.json({
          insightText: "Insufficient data for psychology review. Tag at least 5 trades with mood or mistake categories to unlock this analysis.",
          hasData: false,
        });
      }

      const tradesWithMood = allTrades.filter(t => t.mood);
      const tradesWithMistake = allTrades.filter(t => t.mistakeCategory && t.mistakeCategory !== "none");

      const moodStats: Record<string, { count: number; wins: number; losses: number; totalPnl: number }> = {};
      for (const t of tradesWithMood) {
        const m = t.mood!;
        if (!moodStats[m]) moodStats[m] = { count: 0, wins: 0, losses: 0, totalPnl: 0 };
        moodStats[m].count++;
        if (t.outcome === "Win") moodStats[m].wins++;
        if (t.outcome === "Loss") moodStats[m].losses++;
        moodStats[m].totalPnl += t.pnl;
      }

      const mistakeStats: Record<string, { count: number; totalPnl: number; avgPnl: number }> = {};
      for (const t of tradesWithMistake) {
        const m = t.mistakeCategory!;
        if (!mistakeStats[m]) mistakeStats[m] = { count: 0, totalPnl: 0, avgPnl: 0 };
        mistakeStats[m].count++;
        mistakeStats[m].totalPnl += t.pnl;
      }
      for (const key of Object.keys(mistakeStats)) {
        mistakeStats[key].avgPnl = mistakeStats[key].totalPnl / mistakeStats[key].count;
      }

      const moodMistakeCorrelations: Record<string, string[]> = {};
      for (const t of allTrades.filter(t => t.mood && t.mistakeCategory && t.mistakeCategory !== "none")) {
        if (!moodMistakeCorrelations[t.mood!]) moodMistakeCorrelations[t.mood!] = [];
        moodMistakeCorrelations[t.mood!].push(t.mistakeCategory!);
      }

      const totalPnl = allTrades.reduce((s, t) => s + t.pnl, 0);
      const winRate = allTrades.length > 0
        ? ((allTrades.filter(t => t.outcome === "Win").length / allTrades.length) * 100).toFixed(1)
        : "0";

      const moodSummary = Object.entries(moodStats)
        .map(([mood, s]) => `${mood}: ${s.count} trades, ${s.wins}W/${s.losses}L, P&L $${s.totalPnl.toFixed(2)}, WR ${s.count > 0 ? ((s.wins / s.count) * 100).toFixed(0) : 0}%`)
        .join("\n");

      const mistakeSummary = Object.entries(mistakeStats)
        .sort((a, b) => a[1].totalPnl - b[1].totalPnl)
        .map(([mistake, s]) => `${mistake.replace(/_/g, " ")}: ${s.count} occurrences, total P&L $${s.totalPnl.toFixed(2)}, avg $${s.avgPnl.toFixed(2)}`)
        .join("\n");

      const correlationSummary = Object.entries(moodMistakeCorrelations)
        .map(([mood, mistakes]) => {
          const freq: Record<string, number> = {};
          mistakes.forEach(m => { freq[m] = (freq[m] || 0) + 1; });
          const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2);
          return `When ${mood}: most common mistakes are ${top.map(([m, c]) => `${m.replace(/_/g, " ")} (${c}x)`).join(", ")}`;
        })
        .join("\n");

      const prompt = `You are a Trading Psychology Analyst for TRADIFY, a rule-based trading journal.

${TRADING_KNOWLEDGE_CONTEXT}

Analyze this trader's psychology-performance data from the last ${periodDays} days and provide a structured review.

STRICT RULES:
- Descriptive and factual observations ONLY
- NO trading advice, entry/exit suggestions, or market predictions
- Focus on PSYCHOLOGY patterns, emotional correlations, and behavioral tendencies
- Use data-driven language: "The data shows...", "Trades taken while..."
- Be specific with numbers and percentages
- Include the disclaimer: "This is not financial advice."

OVERVIEW:
- Total Trades: ${allTrades.length}
- Overall Win Rate: ${winRate}%
- Total P&L: $${totalPnl.toFixed(2)}
- Trades with mood tagged: ${tradesWithMood.length}/${allTrades.length}
- Trades with mistakes tagged: ${tradesWithMistake.length}/${allTrades.length}

${tradesWithMood.length > 0 ? `MOOD-PERFORMANCE BREAKDOWN:
${moodSummary}` : "No mood data tagged yet."}

${tradesWithMistake.length > 0 ? `MISTAKE IMPACT ANALYSIS:
${mistakeSummary}` : "No mistake data tagged yet."}

${Object.keys(moodMistakeCorrelations).length > 0 ? `MOOD-MISTAKE CORRELATIONS:
${correlationSummary}` : ""}

FORMAT YOUR RESPONSE EXACTLY:

## Psychology & Performance Review

### Emotional Edge
[2-3 observations about which moods correlate with best/worst results]

### Costliest Mistakes
[2-3 observations about which mistakes have the biggest P&L impact]

### Behavioral Patterns
[2-3 observations about mood-mistake correlations and tendencies]

### Psychology Score
[Give a score out of 10 based on: % of trades tagged, emotional consistency, mistake awareness. Briefly justify.]

---
*This review is auto-generated based on your tagged trading data. It is not financial advice.*`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
      });

      const reviewText = response.choices[0].message.content || "Unable to generate psychology review.";

      const metadata = {
        period: periodDays,
        totalTrades: allTrades.length,
        taggedMood: tradesWithMood.length,
        taggedMistake: tradesWithMistake.length,
        moodStats,
        mistakeStats,
        generatedAt: new Date().toISOString(),
      };

      const saved = await storage.saveAIInsight({
        userId,
        timeframe: cacheKey,
        insightText: reviewText,
        metadata,
      });

      await storage.logAIRequest({ userId, prompt, response: reviewText });

      res.json({ ...saved, cached: false, metadata });
    } catch (error) {
      console.error("Psychology Review Error:", error);
      res.status(500).json({ message: "Psychology review generation failed" });
    }
  });

  // MONTHLY SELF-REVIEW REPORT - Elite only
  // AI-generated monthly performance review
  app.get("/api/monthly-review/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { month, year } = req.query;
      
      // Verify user access
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Elite tier check
      const user = await storage.getUserRole(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!canAccessFeature(user.subscriptionTier || "FREE", "sessionAnalytics")) {
        return res.status(403).json({ 
          message: "Elite subscription required for Monthly Self-Review",
          requiredTier: "ELITE"
        });
      }

      // Determine which month to review (default: previous month)
      const now = new Date();
      const targetMonth = month ? parseInt(month as string) : now.getMonth() === 0 ? 12 : now.getMonth();
      const targetYear = year ? parseInt(year as string) : now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      
      const monthKey = `monthly-review-${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      
      // Check for cached report
      const existing = await storage.getAIInsights(userId, monthKey);
      if (existing.length > 0) {
        return res.json({
          ...existing[0],
          month: targetMonth,
          year: targetYear,
          cached: true,
        });
      }

      // Calculate date ranges
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      const prevMonthStart = new Date(targetYear, targetMonth - 2, 1);
      const prevMonthEnd = new Date(targetYear, targetMonth - 1, 0, 23, 59, 59);

      // Get MT5 trades for current and previous month
      const allMt5Trades = await db
        .select()
        .from(schema.mt5History)
        .where(eq(schema.mt5History.userId, userId));
      
      const manualTrades = await storage.getTrades(userId);

      // Filter trades by month
      const currentMonthMt5 = allMt5Trades.filter(t => {
        const closeTime = new Date(t.closeTime);
        return closeTime >= monthStart && closeTime <= monthEnd;
      });
      
      const prevMonthMt5 = allMt5Trades.filter(t => {
        const closeTime = new Date(t.closeTime);
        return closeTime >= prevMonthStart && closeTime <= prevMonthEnd;
      });

      const currentMonthManual = manualTrades.filter(t => {
        const date = new Date(t.createdAt!);
        return date >= monthStart && date <= monthEnd;
      });

      const prevMonthManual = manualTrades.filter(t => {
        const date = new Date(t.createdAt!);
        return date >= prevMonthStart && date <= prevMonthEnd;
      });

      // Calculate current month metrics
      const currentTrades = [
        ...currentMonthMt5.map(t => ({ pnl: parseFloat(t.netPl), volume: parseFloat(t.volume || "0") })),
        ...currentMonthManual.map(t => ({ pnl: parseFloat(t.netPl || "0"), volume: 0 }))
      ];

      const prevTrades = [
        ...prevMonthMt5.map(t => ({ pnl: parseFloat(t.netPl), volume: parseFloat(t.volume || "0") })),
        ...prevMonthManual.map(t => ({ pnl: parseFloat(t.netPl || "0"), volume: 0 }))
      ];

      if (currentTrades.length < 5) {
        return res.json({
          message: "Insufficient data for monthly review. At least 5 trades required.",
          month: targetMonth,
          year: targetYear,
          hasData: false,
        });
      }

      // Calculate metrics
      const calcMetrics = (trades: { pnl: number; volume: number }[]) => {
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);
        const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
        const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
        const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? Infinity : 0;
        
        return {
          tradeCount: trades.length,
          wins: wins.length,
          losses: losses.length,
          totalPnL,
          winRate,
          avgWin,
          avgLoss,
          profitFactor: profitFactor === Infinity ? "N/A" : profitFactor.toFixed(2),
        };
      };

      const currentMetrics = calcMetrics(currentTrades);
      const prevMetrics = calcMetrics(prevTrades);

      // Get behavioral flags for context
      let behavioralFlags: any[] = [];
      try {
        const behavioralRes = await fetch(`${req.protocol}://${req.get('host')}/api/behavioral-risks/${userId}`, {
          headers: { cookie: req.headers.cookie || "" }
        });
        if (behavioralRes.ok) {
          const behavioralData = await behavioralRes.json();
          behavioralFlags = behavioralData.flags || [];
        }
      } catch (e) {
        // Behavioral data optional
      }

      // Get session analytics for context
      let sessionData: any = null;
      try {
        const sessionRes = await fetch(`${req.protocol}://${req.get('host')}/api/session-analytics/${userId}`, {
          headers: { cookie: req.headers.cookie || "" }
        });
        if (sessionRes.ok) {
          sessionData = await sessionRes.json();
        }
      } catch (e) {
        // Session data optional
      }

      // Get compliance data
      let complianceData: any = null;
      try {
        const complianceRes = await fetch(`${req.protocol}://${req.get('host')}/api/strategy-deviation/${userId}`, {
          headers: { cookie: req.headers.cookie || "" }
        });
        if (complianceRes.ok) {
          complianceData = await complianceRes.json();
        }
      } catch (e) {
        // Compliance data optional
      }

      const monthNames = ["January", "February", "March", "April", "May", "June", 
                          "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[targetMonth - 1];
      const prevMonthName = monthNames[targetMonth === 1 ? 11 : targetMonth - 2];

      // Generate AI review
      const prompt = `You are a Professional Trading Performance Coach for TRADIFY.

${TRADING_KNOWLEDGE_CONTEXT}

Write a REFLECTIVE monthly self-review for ${monthName} ${targetYear}.

STRICT RULES:
- Use REFLECTIVE, first-person observational tone ("I noticed...", "My trading showed...", "This month revealed...")
- NO trading advice or recommendations
- NO predictions about future markets
- NO specific entry/exit suggestions
- FACTUAL observations only
- Keep it PERSONAL and REFLECTIVE
- Acknowledge both improvements and areas of concern

CURRENT MONTH (${monthName}):
- Total Trades: ${currentMetrics.tradeCount}
- Win Rate: ${currentMetrics.winRate.toFixed(1)}%
- Total P&L: $${currentMetrics.totalPnL.toFixed(2)}
- Profit Factor: ${currentMetrics.profitFactor}
- Wins: ${currentMetrics.wins}, Losses: ${currentMetrics.losses}
- Avg Win: $${currentMetrics.avgWin.toFixed(2)}, Avg Loss: $${currentMetrics.avgLoss.toFixed(2)}

${prevMetrics.tradeCount > 0 ? `PREVIOUS MONTH (${prevMonthName}):
- Total Trades: ${prevMetrics.tradeCount}
- Win Rate: ${prevMetrics.winRate.toFixed(1)}%
- Total P&L: $${prevMetrics.totalPnL.toFixed(2)}
- Profit Factor: ${prevMetrics.profitFactor}` : "Previous month: No comparison data available"}

${behavioralFlags.length > 0 ? `BEHAVIORAL OBSERVATIONS:
${behavioralFlags.slice(0, 3).map((f: any) => `- ${f.title}: ${f.description}`).join('\n')}` : ""}

${sessionData?.sessions ? `BEST SESSION: ${sessionData.sessions.reduce((best: any, s: any) => s.pnl > (best?.pnl || -Infinity) ? s : best, null)?.session || "N/A"}` : ""}

${complianceData?.hasData ? `STRATEGY COMPLIANCE: ${complianceData.summary?.overallComplianceRate?.toFixed(1) || "N/A"}%` : ""}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

## Monthly Self-Review: ${monthName} ${targetYear}

### What Improved
[2-3 factual observations about improvements]

### What Needs Attention
[2-3 factual observations about areas that worsened or need focus]

### Key Behavioral Observations
[2-3 observations about trading patterns or behaviors]

### Best-Performing Conditions
[1-2 observations about when trading worked best]

---
*This review is auto-generated based on trading data. It is not financial advice.*`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      });

      const reviewText = response.choices[0].message.content || "Unable to generate review at this time.";

      // Save the report
      const savedReport = await storage.saveAIInsight({
        userId,
        timeframe: monthKey,
        insightText: reviewText,
        metadata: {
          currentMetrics,
          prevMetrics,
          behavioralFlagsCount: behavioralFlags.length,
          hasSessionData: !!sessionData,
          hasComplianceData: !!complianceData?.hasData,
          generatedAt: new Date().toISOString(),
        }
      });

      await storage.logAIRequest({
        userId,
        prompt,
        response: reviewText
      });

      res.json({
        ...savedReport,
        month: targetMonth,
        year: targetYear,
        cached: false,
        metrics: {
          current: currentMetrics,
          previous: prevMetrics,
        }
      });
    } catch (error) {
      console.error("Monthly Review Error:", error);
      res.status(500).json({ message: "Monthly review generation failed" });
    }
  });

  // Get available months for review
  app.get("/api/monthly-review/:userId/available", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all trades to determine available months
      const mt5Trades = await db
        .select({ closeTime: schema.mt5History.closeTime })
        .from(schema.mt5History)
        .where(eq(schema.mt5History.userId, userId));

      const manualTrades = await storage.getTrades(userId);

      const months = new Set<string>();
      
      for (const trade of mt5Trades) {
        const date = new Date(trade.closeTime);
        months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
      
      for (const trade of manualTrades) {
        if (trade.createdAt) {
          const date = new Date(trade.createdAt);
          months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        }
      }

      const sortedMonths = Array.from(months).sort().reverse();
      
      res.json({ 
        availableMonths: sortedMonths.map(m => {
          const [year, month] = m.split('-');
          return { year: parseInt(year), month: parseInt(month), key: m };
        })
      });
    } catch (error) {
      console.error("Available months error:", error);
      res.status(500).json({ message: "Failed to fetch available months" });
    }
  });

  // Get unique instruments from user's MT5 history
  app.get("/api/instruments/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Authorization: Ensure user can only access their own data
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get unique symbols from mt5_history
      const history = await db.select({
        symbol: schema.mt5History.symbol
      })
        .from(schema.mt5History)
        .where(eq(schema.mt5History.userId, userId))
        .groupBy(schema.mt5History.symbol);
      
      const symbols = history.map(h => h.symbol);
      res.json({ symbols });
    } catch (error) {
      console.error("Instruments Error:", error);
      res.status(500).json({ message: "Failed to fetch instruments" });
    }
  });

  // Get instrument stats (performance data for a specific symbol)
  app.get("/api/instruments/:userId/:symbol/stats", requireAuth, async (req, res) => {
    try {
      const { userId, symbol } = req.params;
      const sessionUserId = req.session.userId!;
      
      // Authorization: Ensure user can only access their own data
      if (sessionUserId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get user's subscription tier for history filtering
      const userRole = await storage.getUserRole(sessionUserId);
      const historyDays = getHistoryDays(userRole?.subscriptionTier);
      
      const allTrades = await db.select()
        .from(schema.mt5History)
        .where(and(
          eq(schema.mt5History.userId, userId),
          eq(schema.mt5History.symbol, symbol)
        ));
      
      // Apply tier-based date filtering
      const trades = filterByTierDate(allTrades, historyDays);
      
      if (trades.length === 0) {
        return res.json({ 
          tradeCount: 0, 
          winRate: "0", 
          avgProfitLoss: "0", 
          totalProfitLoss: "0",
          trades: []
        });
      }
      
      const wins = trades.filter(t => parseFloat(t.netPl) > 0).length;
      const winRate = ((wins / trades.length) * 100).toFixed(1);
      const totalPl = trades.reduce((sum, t) => sum + parseFloat(t.netPl), 0);
      const avgPl = totalPl / trades.length;
      
      // Get recent trades (last 10) for context
      const recentTrades = trades
        .sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime())
        .slice(0, 10)
        .map(t => ({
          direction: t.direction,
          netPl: t.netPl,
          duration: t.duration,
          closeTime: t.closeTime
        }));
      
      res.json({
        tradeCount: trades.length,
        winRate,
        avgProfitLoss: avgPl.toFixed(2),
        totalProfitLoss: totalPl.toFixed(2),
        trades: recentTrades
      });
    } catch (error) {
      console.error("Instrument Stats Error:", error);
      res.status(500).json({ message: "Failed to fetch instrument stats" });
    }
  });

  // Generate AI analysis for a specific instrument (PRO only)
  app.post("/api/ai/instrument-analysis/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { symbol } = req.body;
      
      // Authorization: Ensure user can only access their own data
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Check AI analysis access based on plan
      const userRole = await storage.getUserRole(userId);
      if (!canAccessFeature(userRole?.subscriptionTier, "aiAnalysis")) {
        return res.status(403).json({ message: "Pro or Elite subscription required for AI analysis" });
      }
      
      if (!symbol) {
        return res.status(400).json({ message: "Symbol is required" });
      }
      
      // Check cache - only regenerate if older than 30 minutes
      const existing = await db.select()
        .from(schema.instrumentAnalyses)
        .where(and(
          eq(schema.instrumentAnalyses.userId, userId),
          eq(schema.instrumentAnalyses.symbol, symbol)
        ))
        .orderBy(desc(schema.instrumentAnalyses.createdAt))
        .limit(1);
      
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      if (existing.length > 0 && new Date(existing[0].createdAt!) > thirtyMinsAgo) {
        return res.json(existing[0]);
      }
      
      // Fetch instrument stats directly from database
      const trades = await db.select()
        .from(schema.mt5History)
        .where(and(
          eq(schema.mt5History.userId, userId),
          eq(schema.mt5History.symbol, symbol)
        ));
      
      if (trades.length < 1) {
        return res.json({ 
          analysisText: "No trading history available for this instrument.", 
          symbol,
          tradeCount: 0 
        });
      }
      
      // Calculate stats
      const wins = trades.filter(t => parseFloat(t.netPl) > 0).length;
      const winRate = ((wins / trades.length) * 100).toFixed(1);
      const totalPl = trades.reduce((sum, t) => sum + parseFloat(t.netPl), 0);
      const avgPl = totalPl / trades.length;
      
      // Get recent trades for AI context
      const recentTrades = trades
        .sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime())
        .slice(0, 5)
        .map(t => ({
          direction: t.direction,
          netPl: t.netPl,
          closeTime: t.closeTime
        }));
      
      // Generate AI analysis - General market context (no real-time data available)
      const prompt = `You are a Professional Market Analyst for TRADIFY trading journal.

${TRADING_KNOWLEDGE_CONTEXT}

ANALYZE: ${symbol}

TRADER'S PERFORMANCE ON THIS INSTRUMENT:
- Total Trades: ${trades.length}
- Win Rate: ${winRate}%
- Average P&L: $${avgPl.toFixed(2)}
- Total P&L: $${totalPl.toFixed(2)}
- Recent Trades: ${JSON.stringify(recentTrades)}

IMPORTANT: You do NOT have access to real-time prices. Do NOT mention any specific price levels.

ANALYSIS REQUIREMENTS:
- Assess the trader's performance on this instrument based on the data
- Reference relevant trading concepts (market structure, session timing, etc.)
- General characteristics of how ${symbol} typically behaves
- Key factors that influence this instrument

STRICT RULES:
- NO specific price levels (you don't have real-time data)
- NO "current price is X" statements
- NO trade recommendations
- Focus on factual performance observations

Provide a concise 4-5 sentence analysis covering:
1. Trader's performance pattern on ${symbol} (using the data above)
2. What fundamentally drives ${symbol} price movements
3. Which trading sessions tend to have best movement for ${symbol}

End with: "Review your charts for current market structure."`;

      console.log("Calling OpenAI for instrument analysis with model gpt-4o-mini...");
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
      });
      console.log("OpenAI response:", JSON.stringify(response.choices[0]));

      const analysisText = response.choices[0].message.content || "Unable to generate analysis.";
      
      // Save to database
      const [saved] = await db.insert(schema.instrumentAnalyses).values({
        userId,
        symbol,
        analysisText,
        tradeCount: trades.length,
        winRate: winRate,
        avgProfitLoss: avgPl.toFixed(2),
        totalProfitLoss: totalPl.toFixed(2)
      }).returning();
      
      res.json(saved);
    } catch (error: any) {
      console.error("Instrument Analysis Error:", error?.message || error);
      console.error("Full error:", JSON.stringify(error, null, 2));
      res.status(500).json({ message: "AI Analysis failed", error: error?.message });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await db.select().from(schema.userRole);
    res.json(users);
  });

  // Get all early access signups for admin
  app.get("/api/admin/early-access", requireAdmin, async (req, res) => {
    try {
      const signups = await db.select().from(schema.earlyAccessSignups).orderBy(schema.earlyAccessSignups.createdAt);
      res.json(signups);
    } catch (error) {
      console.error("Error fetching early access signups:", error);
      res.status(500).json({ message: "Failed to fetch early access signups" });
    }
  });

  // Get all founding members for admin
  app.get("/api/admin/founding-members", requireAdmin, async (req, res) => {
    try {
      const foundingMembers = await db.select()
        .from(schema.userRole)
        .where(eq(schema.userRole.foundingMember, true));
      res.json(foundingMembers);
    } catch (error) {
      console.error("Error fetching founding members:", error);
      res.status(500).json({ message: "Failed to fetch founding members" });
    }
  });

  // Toggle founding member status for a user
  app.patch("/api/admin/users/:userId/founding-member", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { foundingMember } = req.body;
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await db.update(schema.userRole)
        .set({ foundingMember, updatedAt: new Date() })
        .where(eq(schema.userRole.userId, userId));

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: foundingMember ? "GRANT_FOUNDING_MEMBER" : "REVOKE_FOUNDING_MEMBER",
        targetUserId: userId,
        details: { timestamp: new Date() }
      });

      res.json({ success: true, message: `Founding member status ${foundingMember ? 'granted' : 'revoked'}` });
    } catch (error) {
      console.error("Error updating founding member status:", error);
      res.status(500).json({ message: "Failed to update founding member status" });
    }
  });

  // Grant Pro access to a founding member
  app.patch("/api/admin/users/:userId/grant-pro", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await db.update(schema.userRole)
        .set({ 
          subscriptionTier: "PRO", 
          subscriptionStatus: "founding_member_access",
          updatedAt: new Date() 
        })
        .where(eq(schema.userRole.userId, userId));

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId: req.session.userId!,
        actionType: "GRANT_FOUNDING_MEMBER_PRO",
        targetUserId: userId,
        details: { timestamp: new Date() }
      });

      res.json({ success: true, message: "Pro access granted to founding member" });
    } catch (error) {
      console.error("Error granting Pro access:", error);
      res.status(500).json({ message: "Failed to grant Pro access" });
    }
  });

  // Get founding member suggestions for admin
  app.get("/api/admin/founding-suggestions", requireAdmin, async (req, res) => {
    try {
      const suggestions = await db.select()
        .from(schema.foundingMemberSuggestions)
        .orderBy(schema.foundingMemberSuggestions.createdAt);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  // Update suggestion status (admin)
  app.patch("/api/admin/founding-suggestions/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, adminNotes } = req.body;
      
      await db.update(schema.foundingMemberSuggestions)
        .set({ status, adminNotes })
        .where(eq(schema.foundingMemberSuggestions.id, id));

      res.json({ success: true, message: "Suggestion updated" });
    } catch (error) {
      console.error("Error updating suggestion:", error);
      res.status(500).json({ message: "Failed to update suggestion" });
    }
  });

  // Submit suggestion (founding members only)
  app.post("/api/founding-suggestions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      // Check if user is a founding member
      const [user] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!user?.foundingMember) {
        return res.status(403).json({ message: "Only founding members can submit suggestions" });
      }

      const { category, title, description } = req.body;
      if (!category || !title || !description) {
        return res.status(400).json({ message: "All fields are required: category, title, and description" });
      }

      if (title.length > 200) {
        return res.status(400).json({ message: "Title must be under 200 characters" });
      }
      if (description.length > 2000) {
        return res.status(400).json({ message: "Description must be under 2000 characters" });
      }

      await db.insert(schema.foundingMemberSuggestions).values({
        userId,
        category,
        title: title.trim(),
        description: description.trim(),
        status: "pending"
      });

      res.status(201).json({ success: true, message: "Suggestion submitted successfully" });
    } catch (error: any) {
      console.error("Error submitting suggestion:", error?.message || error, error?.stack);
      const msg = error?.message?.includes("relation") 
        ? "Database table not found. Please contact support."
        : "Failed to submit suggestion. Please try again.";
      res.status(500).json({ message: msg });
    }
  });

  // Get user's own suggestions (founding members)
  app.get("/api/founding-suggestions", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const suggestions = await db.select()
        .from(schema.foundingMemberSuggestions)
        .where(eq(schema.foundingMemberSuggestions.userId, userId))
        .orderBy(schema.foundingMemberSuggestions.createdAt);
      
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  app.post("/api/admin/create-user", requireAdmin, async (req, res) => {
    try {
      const { email, subscriptionTier, role, tempPassword } = req.body;
      const adminId = req.session.userId!;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Normalize email to lowercase (matches login behavior)
      const normalizedEmail = email.toLowerCase().trim();

      // Validate subscription tier
      const validTiers = ["FREE", "PRO", "ELITE"];
      const tier = validTiers.includes(subscriptionTier?.toUpperCase()) 
        ? subscriptionTier.toUpperCase() 
        : "FREE";

      // Check if user already exists
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, normalizedEmail)).limit(1);
      if (existing) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate or use provided temporary password
      const password = tempPassword || `Tradify${Math.random().toString(36).substring(2, 8)}!`;
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the user with hashed password
      const newUser = await storage.createUserRole({
        userId: normalizedEmail,
        password: hashedPassword,
        role: role || "TRADER",
        subscriptionTier: tier,
        termsAccepted: true,
        riskAcknowledged: true,
        mustResetPassword: true, // Admin-created users must reset password on first login
      });

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId,
        actionType: "CREATE_USER",
        targetUserId: normalizedEmail,
        details: { subscriptionTier: tier, role: role || "USER" }
      });

      // Send welcome email with temporary password
      const userName = normalizedEmail.split('@')[0];
      await emailService.sendAdminCreatedUserEmail(normalizedEmail, userName, password);

      res.json({ success: true, user: newUser, tempPassword: password });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.post("/api/admin/update-user", requireAdmin, async (req, res) => {
    try {
      const { targetUserId, updates } = req.body;
      const adminId = req.session.userId!;
      
      // If subscriptionTier is being updated, use the dedicated storage method
      if (updates.subscriptionTier) {
        await storage.updateUserSubscription(targetUserId, updates.subscriptionTier);
        
        // Audit log
        await db.insert(schema.adminAuditLog).values({
          adminId,
          actionType: `SET_PLAN_${updates.subscriptionTier}`,
          targetUserId,
          details: { updates }
        });
        
        delete updates.subscriptionTier; // Remove from updates object to avoid duplicate update below
      }

      // Handle role update (Deactivation/Reactivation)
      if (updates.role) {
        await db.insert(schema.adminAuditLog).values({
          adminId,
          actionType: updates.role === "DEACTIVATED" ? "DEACTIVATE_USER" : "ACTIVATE_USER",
          targetUserId,
          details: { updates }
        });
      }

      // Handle any other role/meta updates
      if (Object.keys(updates).length > 0) {
        await db.update(schema.userRole)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(schema.userRole.userId, targetUserId));
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const logs = await db.select().from(schema.adminAuditLog).orderBy(desc(schema.adminAuditLog.timestamp));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // --- Admin Access Management ---
  app.get("/api/admin/creator-applications", requireAdmin, async (req, res) => {
    try {
      const apps = await storage.getCreatorApplications();
      res.json(apps);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.post("/api/admin/creator-applications/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const adminId = req.session.userId!;
      const id = parseInt(req.params.id);

      await storage.updateCreatorApplicationStatus(id, status);

      // Audit log
      await db.insert(schema.adminAuditLog).values({
        adminId,
        actionType: `CREATOR_APP_${status}`,
        targetUserId: "SYSTEM", // The application has its own userId
        details: { applicationId: id, status }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update application status" });
    }
  });

  app.get("/api/admin/access", requireAdmin, async (req, res) => {
    const admins = await db.select().from(schema.adminAccess);
    res.json(admins);
  });

  app.post("/api/admin/access", requireAdmin, async (req, res) => {
    const { email, label } = req.body;
    const accessKey = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const [newAdmin] = await db.insert(schema.adminAccess).values({
      email,
      label,
      accessKey,
    }).returning();
    
    res.json(newAdmin);
  });

  app.delete("/api/admin/access/:id", requireAdmin, async (req, res) => {
    await db.delete(schema.adminAccess).where(eq(schema.adminAccess.id, parseInt(req.params.id)));
    res.json({ success: true });
  });

  // Seed data on startup
  await seedDatabase();

  app.get("/api/user/role", async (req, res) => {
    // Check for hardcoded admin first
    const userId = req.query.userId as string || req.headers["x-user-id"] as string;
    const country = req.query.country as string;
    const phoneNumber = req.query.phoneNumber as string;
    const timezone = req.query.timezone as string;
    
    if (!userId) {
      return res.status(400).json({ message: "UserId required" });
    }
    
    // Check dynamic admin access table
    const [dynamicAdmin] = await db.select().from(schema.adminAccess).where(eq(schema.adminAccess.email, userId)).limit(1);

    if (userId === "mohammad@admin.com" || (dynamicAdmin && dynamicAdmin.isActive)) {
      const [existing] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      if (!existing || existing.role !== 'OWNER') {
        await storage.updateUserSubscription(userId, "PRO");
        await db.update(schema.userRole).set({ role: 'OWNER' }).where(eq(schema.userRole.userId, userId));
      }
      return res.json({ userId, role: 'OWNER', subscriptionTier: 'PRO' });
    }

    let role = await storage.getUserRole(userId);
    
    // Create role if it doesn't exist
    if (!role) {
      const syncToken = Math.random().toString(36).substring(2, 15);
      role = await storage.createUserRole({
        userId,
        role: userId === "dev-user" ? "OWNER" : "TRADER",
        country: country || null,
        phoneNumber: phoneNumber || null,
        timezone: timezone || null,
        subscriptionTier: "FREE",
        syncToken
      });
      if (userId === "dev-user") {
        await storage.updateUserSubscription(userId, "FREE");
      }
    } else if (country || phoneNumber || timezone) {
      // Update existing if new info provided during login/signup sync
      await db.update(schema.userRole)
        .set({ 
          country: country || role.country, 
          phoneNumber: phoneNumber || role.phoneNumber,
          timezone: timezone || role.timezone,
          updatedAt: new Date() 
        })
        .where(eq(schema.userRole.userId, userId));
      
      // Refresh role data
      role = await storage.getUserRole(userId);
    }
    
    return res.json(role || { userId, subscriptionTier: "FREE", role: "TRADER" });
  });

  app.post("/api/user/upgrade-dev", async (req, res) => {
    const userId = req.headers["x-user-id"] as string || "dev-user";
    await storage.updateUserSubscription(userId, "PRO");
    res.json({ success: true, message: "Developer PRO access granted" });
  });

  app.post("/api/user/update-profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { country, phoneNumber, timezone } = req.body;
      
      await db.update(schema.userRole)
        .set({ 
          country, 
          phoneNumber, 
          timezone, 
          updatedAt: new Date() 
        })
        .where(eq(schema.userRole.userId, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const user = await db.query.userRole.findFirst({
        where: eq(schema.userRole.userId, userId),
      });

      if (!user || !user.password) {
        return res.status(404).json({ message: "User not found" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.update(schema.userRole)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.userRole.userId, userId));

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.post("/api/user/deactivate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      await db.update(schema.userRole)
        .set({ role: "DEACTIVATED", updatedAt: new Date() })
        .where(eq(schema.userRole.userId, userId));
      
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Deactivation failed" });
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate account" });
    }
  });

  app.post("/api/user/reset-password-request", async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase();
    
    // For demo/emergency purposes: If it's the user's email, we'll reset it to a temporary one
    if (normalizedEmail === "scarymohd2@gmail.com") {
      const hashedPassword = await bcrypt.hash("Tradify2026!", 10);
      await db.update(schema.userRole)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.userRole.userId, normalizedEmail));
      return res.json({ message: "EMERGENCY RESET: Password set to Tradify2026!" });
    }

    console.log(`Password reset requested for: ${normalizedEmail}`);
    res.json({ message: "If an account exists, a reset link has been sent." });
  });

  // ===== STRATEGY ROUTES =====

  // Get all strategies for user
  app.get("/api/strategies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategies = await storage.getStrategies(userId);
      
      // Include rules count for each strategy
      const strategiesWithRules = await Promise.all(
        strategies.map(async (strategy) => {
          const rules = await storage.getStrategyRules(strategy.id);
          return { ...strategy, rules };
        })
      );
      
      res.json(strategiesWithRules);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ message: "Failed to fetch strategies" });
    }
  });

  // Get active strategy for user
  app.get("/api/strategies/active", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategy = await storage.getActiveStrategy(userId);
      res.json(strategy || null);
    } catch (error) {
      console.error("Error fetching active strategy:", error);
      res.status(500).json({ message: "Failed to fetch active strategy" });
    }
  });

  // Get single strategy by ID
  app.get("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      const strategy = await storage.getStrategy(strategyId);
      
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      
      // Ownership check
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const rules = await storage.getStrategyRules(strategyId);
      res.json({ ...strategy, rules });
    } catch (error) {
      console.error("Error fetching strategy:", error);
      res.status(500).json({ message: "Failed to fetch strategy" });
    }
  });

  // Create new strategy
  app.post("/api/strategies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { name, description, isActive, rules } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Strategy name is required" });
      }
      
      // Check strategy limit based on plan
      const user = await storage.getUserRole(userId);
      const maxStrategies = getMaxStrategies(user?.subscriptionTier);
      
      if (maxStrategies !== -1) {
        const existingStrategies = await storage.getStrategies(userId);
        
        if (existingStrategies.length >= maxStrategies) {
          return res.status(403).json({ 
            message: "Strategy limit reached",
            error: "PLAN_LIMIT_REACHED",
            limit: maxStrategies,
            current: existingStrategies.length
          });
        }
      }
      
      // Create strategy
      const strategy = await storage.createStrategy({
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: false, // Will set active separately if needed
      });
      
      // Create rules
      if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          await storage.createStrategyRule({
            strategyId: strategy.id,
            category: rule.definition.category,
            label: rule.customLabel || rule.definition.label,
            description: rule.definition.description || null,
            ruleType: rule.ruleType,
            options: {
              inputType: rule.definition.inputType,
              value: rule.value,
              validation: rule.definition.validation,
            },
            defaultValue: String(rule.definition.defaultValue ?? ""),
            isRequired: rule.definition.inputType === "boolean" ? rule.value === true : true,
            sortOrder: i,
          });
        }
      }
      
      // Set as active if requested
      if (isActive) {
        await storage.setActiveStrategy(userId, strategy.id);
      }
      
      const createdRules = await storage.getStrategyRules(strategy.id);
      res.status(201).json({ ...strategy, rules: createdRules, isActive });
    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(500).json({ message: "Failed to create strategy" });
    }
  });

  // Update strategy
  app.patch("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      const { name, description } = req.body;
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updated = await storage.updateStrategy(strategyId, {
        name: name?.trim(),
        description: description?.trim(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating strategy:", error);
      res.status(500).json({ message: "Failed to update strategy" });
    }
  });

  // Delete strategy
  app.delete("/api/strategies/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteStrategy(strategyId);
      res.json({ message: "Strategy deleted" });
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ message: "Failed to delete strategy" });
    }
  });

  // Set active strategy
  app.post("/api/strategies/:id/activate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.setActiveStrategy(userId, strategyId);
      res.json({ message: "Strategy activated" });
    } catch (error) {
      console.error("Error activating strategy:", error);
      res.status(500).json({ message: "Failed to activate strategy" });
    }
  });

  // Duplicate strategy
  app.post("/api/strategies/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const strategyId = parseInt(req.params.id);
      
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check strategy limit based on plan
      const user = await storage.getUserRole(userId);
      const maxStrategies = getMaxStrategies(user?.subscriptionTier);
      
      if (maxStrategies !== -1) {
        const existingStrategies = await storage.getStrategies(userId);
        
        if (existingStrategies.length >= maxStrategies) {
          return res.status(403).json({ 
            message: "Strategy limit reached",
            error: "PLAN_LIMIT_REACHED",
            limit: maxStrategies,
            current: existingStrategies.length
          });
        }
      }
      
      // Get original rules
      const rules = await storage.getStrategyRules(strategyId);
      
      // Create new strategy with copied name
      const newStrategy = await storage.createStrategy({
        userId,
        name: `${strategy.name} (Copy)`,
        description: strategy.description,
        isActive: false,
      });
      
      // Copy rules to new strategy
      for (const rule of rules) {
        await storage.createStrategyRule({
          strategyId: newStrategy.id,
          category: rule.category,
          label: rule.label,
          description: rule.description,
          ruleType: rule.ruleType,
          options: rule.options as Record<string, unknown> | null,
          defaultValue: rule.defaultValue,
          isRequired: rule.isRequired,
          sortOrder: rule.sortOrder,
        });
      }
      
      const newRules = await storage.getStrategyRules(newStrategy.id);
      res.status(201).json({ ...newStrategy, rules: newRules });
    } catch (error) {
      console.error("Error duplicating strategy:", error);
      res.status(500).json({ message: "Failed to duplicate strategy" });
    }
  });

  // ==================== COMPLIANCE EVALUATION ENDPOINTS ====================

  // Evaluate trade compliance against a strategy
  app.post("/api/compliance/evaluate", requireAuth, async (req, res) => {
    try {
      const { tradeId, strategyId, tradeInputs } = req.body;
      const userId = req.session.userId!;

      // Get the trade
      const trade = await storage.getTrade(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }

      // Verify trade ownership
      if (trade.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to evaluate this trade" });
      }

      // Get the strategy and its rules
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ message: "Strategy not found" });
      }

      // Verify strategy ownership
      if (strategy.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to use this strategy" });
      }

      const rules = await storage.getStrategyRules(strategyId);
      if (rules.length === 0) {
        return res.status(400).json({ message: "Strategy has no rules to evaluate" });
      }

      // Import and run the compliance engine
      const { evaluateTradeCompliance } = await import("./complianceEngine");
      const result = evaluateTradeCompliance(trade, rules, tradeInputs || {});

      // Save compliance result with strategy name for historical tracking
      const passedCount = result.ruleEvaluations.filter(e => e.passed).length;
      const complianceResult = await storage.saveComplianceResult({
        tradeId,
        strategyId,
        strategyName: strategy.name,
        userId,
        overallCompliant: result.overallCompliant,
        rulesEvaluated: result.ruleEvaluations.length,
        rulesPassed: passedCount,
      });

      // Save rule evaluations
      const evaluationsToSave = result.ruleEvaluations.map((ruleEval) => ({
        complianceResultId: complianceResult.id,
        ruleId: ruleEval.ruleId,
        ruleType: ruleEval.ruleType,
        ruleLabel: ruleEval.ruleLabel,
        expectedValue: ruleEval.expectedValue as Record<string, unknown> | null,
        actualValue: ruleEval.actualValue as Record<string, unknown> | null,
        passed: ruleEval.passed,
        violationReason: ruleEval.violationReason,
      }));

      await storage.saveRuleEvaluations(evaluationsToSave);

      // Update trade compliance status
      await storage.updateTrade(tradeId, {
        isRuleCompliant: result.overallCompliant,
        violationReason: result.violations.length > 0
          ? result.violations.map(v => v.violationReason).join("; ")
          : null,
      });

      res.json({
        complianceResultId: complianceResult.id,
        overallCompliant: result.overallCompliant,
        ruleEvaluations: result.ruleEvaluations,
        violations: result.violations,
      });
    } catch (error) {
      console.error("Error evaluating compliance:", error);
      res.status(500).json({ message: "Failed to evaluate compliance" });
    }
  });

  // Get compliance result for a trade
  app.get("/api/compliance/trade/:tradeId", requireAuth, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId);
      const userId = req.session.userId!;
      
      const result = await storage.getTradeComplianceResult(tradeId);
      
      if (!result) {
        return res.status(404).json({ message: "No compliance evaluation found for this trade" });
      }
      
      // Verify ownership
      if (result.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this compliance result" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching compliance result:", error);
      res.status(500).json({ message: "Failed to fetch compliance result" });
    }
  });

  // Get compliance history for user (with strategy context preserved)
  app.get("/api/compliance/history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let limit = parseInt(req.query.limit as string) || 50;
      limit = Math.max(1, Math.min(200, isNaN(limit) ? 50 : limit));
      const strategyId = req.query.strategyId ? parseInt(req.query.strategyId as string) : undefined;
      
      const history = await storage.getTradeComplianceHistory(userId, limit, strategyId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching compliance history:", error);
      res.status(500).json({ message: "Failed to fetch compliance history" });
    }
  });

  // Get all compliance evaluations for a specific trade
  app.get("/api/compliance/trade/:tradeId/history", requireAuth, async (req, res) => {
    try {
      const tradeId = parseInt(req.params.tradeId);
      const userId = req.session.userId!;
      
      const trade = await storage.getTrade(tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      if (trade.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view this trade's history" });
      }
      
      const history = await storage.getTradeComplianceResultsByTrade(tradeId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching trade compliance history:", error);
      res.status(500).json({ message: "Failed to fetch trade compliance history" });
    }
  });

  // AI explanation for compliance trends (read-only)
  app.get("/api/compliance/explain", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let tradeCount = parseInt(req.query.trades as string) || 20;
      tradeCount = Math.max(1, Math.min(50, isNaN(tradeCount) ? 20 : tradeCount));
      
      // Get user's active strategy
      const activeStrategy = await storage.getActiveStrategy(userId);
      if (!activeStrategy) {
        return res.status(404).json({ message: "No active strategy found" });
      }
      
      // Get detailed violation data
      const { results, violationsByRule, patterns } = await storage.getDetailedViolations(
        userId, 
        activeStrategy.id, 
        tradeCount
      );
      
      // Check for insufficient data
      if (results.length < 3) {
        return res.json({
          explanation: "Insufficient data for meaningful analysis. At least 3 evaluated trades are needed to identify patterns. Continue trading and evaluating your compliance to build up your history.",
          insufficientData: true,
          tradesAnalyzed: results.length
        });
      }
      
      // Calculate compliance stats
      const compliantCount = results.filter(r => r.overallCompliant).length;
      const compliancePercent = Math.round((compliantCount / results.length) * 100);
      const totalViolations = Object.values(violationsByRule).reduce((sum, v) => sum + v.count, 0);
      
      // Build context for AI
      const violationSummary = Object.entries(violationsByRule)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([ruleType, data]) => `- ${data.ruleLabel}: ${data.count} violations (${data.reasons.slice(0, 3).join('; ')})`)
        .join('\n');
      
      // Build time pattern summary
      const timePatterns = Object.entries(patterns.byTimeOfDay)
        .filter(([_, data]) => data.total > 0)
        .map(([slot, data]) => {
          const rate = data.total > 0 ? Math.round((data.violations / data.total) * 100) : 0;
          return `- ${slot}: ${data.total} trades, ${rate}% violation rate`;
        })
        .join('\n');
      
      // Build day pattern summary
      const dayPatterns = Object.entries(patterns.byDayOfWeek)
        .filter(([_, data]) => data.total > 0)
        .map(([day, data]) => {
          const rate = data.total > 0 ? Math.round((data.violations / data.total) * 100) : 0;
          return `- ${day}: ${data.total} trades, ${rate}% violation rate`;
        })
        .join('\n');
      
      // Use pre-calculated values
      const recentViolationRate = patterns.riskDrift.recentViolationRate;
      const olderViolationRate = patterns.riskDrift.olderViolationRate;
      const recentCompliance = 100 - recentViolationRate;
      const olderCompliance = 100 - olderViolationRate;
      
      const prompt = `You are a trading journal assistant analyzing a trader's rule compliance data. Your role is STRICTLY READ-ONLY:
- You CANNOT create rules
- You CANNOT change scores  
- You CANNOT suggest trades
- You can ONLY explain patterns in the existing compliance data

Analyze this compliance data and provide a brief, factual summary:

Strategy: ${activeStrategy.name}
Trades Analyzed: ${results.length}
Overall Compliance: ${compliancePercent}%
Total Violations: ${totalViolations}

TREND (Risk Drift):
- Recent violation rate: ${recentViolationRate}%
- Older violation rate: ${olderViolationRate}%
- Direction: ${recentViolationRate < olderViolationRate ? 'Improving' : recentViolationRate > olderViolationRate ? 'Declining' : 'Stable'}

TIME-OF-DAY PATTERNS:
${timePatterns || 'No time data available'}

DAY-OF-WEEK PATTERNS:
${dayPatterns || 'No day data available'}

VIOLATION BREAKDOWN BY RULE:
${violationSummary || 'No violations recorded'}

Provide a 3-4 sentence factual summary that:
1. States the overall compliance rate and trend direction
2. Identifies the most frequently violated rule (if any)
3. Notes any time-of-day or day-of-week patterns where violations are concentrated
4. Describes risk drift if recent behavior differs from older behavior

IMPORTANT: Only state facts from the data above. Do not recommend trades or suggest rule changes.`;

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      });
      
      const explanation = response.choices[0]?.message?.content || "Unable to generate explanation.";
      
      res.json({
        explanation,
        insufficientData: false,
        tradesAnalyzed: results.length,
        compliancePercent,
        totalViolations,
        trendComparison: {
          recent: recentCompliance,
          older: olderCompliance
        },
        patterns: {
          byTimeOfDay: patterns.byTimeOfDay,
          byDayOfWeek: patterns.byDayOfWeek,
          riskDrift: patterns.riskDrift
        }
      });
    } catch (error) {
      console.error("Error generating compliance explanation:", error);
      res.status(500).json({ message: "Failed to generate compliance explanation" });
    }
  });

  // Get compliance score for user's active strategy
  app.get("/api/compliance/score", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      let tradeCount = parseInt(req.query.trades as string) || 10;
      tradeCount = Math.max(1, Math.min(100, isNaN(tradeCount) ? 10 : tradeCount));
      
      // Get user's active strategy
      const activeStrategy = await storage.getActiveStrategy(userId);
      if (!activeStrategy) {
        return res.status(404).json({ message: "No active strategy found" });
      }
      
      const score = await storage.getComplianceScore(userId, activeStrategy.id, tradeCount);
      
      res.json({
        strategyId: activeStrategy.id,
        strategyName: activeStrategy.name,
        ...score
      });
    } catch (error) {
      console.error("Error calculating compliance score:", error);
      res.status(500).json({ message: "Failed to calculate compliance score" });
    }
  });

  // PROFESSIONAL PDF REPORT - Pro and Elite only
  app.get("/api/pdf-report/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;
      
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUserRole(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!canAccessFeature(user.subscriptionTier || "FREE", "pdfReports")) {
        return res.status(403).json({ 
          message: "Pro or Elite subscription required for PDF Reports",
          requiredTier: "PRO"
        });
      }

      // Fetch all necessary data
      const mt5Trades = await db
        .select()
        .from(schema.mt5History)
        .where(eq(schema.mt5History.userId, userId));
      
      const manualTrades = await storage.getTrades(userId);

      // Apply tier-based date filtering
      const tierConfig = PLAN_FEATURES[user.subscriptionTier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.FREE;
      const historyDays = tierConfig.historyDays;
      const cutoffDate = historyDays > 0 ? new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000) : null;

      // Filter trades by date range if provided
      let filteredMt5 = mt5Trades;
      let filteredManual = manualTrades;

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        filteredMt5 = mt5Trades.filter(t => {
          const d = new Date(t.closeTime);
          return d >= start && d <= end;
        });
        filteredManual = manualTrades.filter(t => {
          const d = new Date(t.createdAt!);
          return d >= start && d <= end;
        });
      } else if (cutoffDate) {
        filteredMt5 = mt5Trades.filter(t => new Date(t.closeTime) >= cutoffDate);
        filteredManual = manualTrades.filter(t => new Date(t.createdAt!) >= cutoffDate);
      }

      // Combine trades
      const allTrades = [
        ...filteredMt5.map(t => ({
          pnl: parseFloat(t.netPl),
          volume: parseFloat(t.volume || "0"),
          date: new Date(t.closeTime),
          symbol: t.symbol,
          source: 'MT5'
        })),
        ...filteredManual.map(t => ({
          pnl: parseFloat(t.netPl || "0"),
          volume: 0,
          date: new Date(t.createdAt!),
          symbol: t.pair || 'Unknown',
          source: 'Manual'
        }))
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      if (allTrades.length < 1) {
        return res.status(400).json({ message: "No trades available for report" });
      }

      // Calculate performance metrics
      const totalTrades = allTrades.length;
      const wins = allTrades.filter(t => t.pnl > 0);
      const losses = allTrades.filter(t => t.pnl < 0);
      const breakeven = allTrades.filter(t => t.pnl === 0);
      const totalPnL = allTrades.reduce((sum, t) => sum + t.pnl, 0);
      const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
      const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
      const profitFactor = avgLoss > 0 && losses.length > 0 
        ? (avgWin * wins.length) / (avgLoss * losses.length) 
        : wins.length > 0 ? Infinity : 0;
      const expectancy = totalTrades > 0 
        ? ((winRate / 100) * avgWin) - ((1 - winRate / 100) * avgLoss) 
        : 0;
      const bestTrade = Math.max(...allTrades.map(t => t.pnl));
      const worstTrade = Math.min(...allTrades.map(t => t.pnl));

      // Session analysis
      const sessions = { Asian: 0, London: 0, 'London/NY': 0, 'New York': 0, 'Off Hours': 0 };
      const sessionPnL = { Asian: 0, London: 0, 'London/NY': 0, 'New York': 0, 'Off Hours': 0 };
      
      allTrades.forEach(t => {
        const hour = t.date.getUTCHours();
        let session: keyof typeof sessions;
        if (hour >= 0 && hour < 7) session = 'Asian';
        else if (hour >= 7 && hour < 12) session = 'London';
        else if (hour >= 12 && hour < 16) session = 'London/NY';
        else if (hour >= 16 && hour < 21) session = 'New York';
        else session = 'Off Hours';
        sessions[session]++;
        sessionPnL[session] += t.pnl;
      });

      // Symbol breakdown
      const symbolStats: Record<string, { count: number; pnl: number; wins: number }> = {};
      allTrades.forEach(t => {
        if (!symbolStats[t.symbol]) {
          symbolStats[t.symbol] = { count: 0, pnl: 0, wins: 0 };
        }
        symbolStats[t.symbol].count++;
        symbolStats[t.symbol].pnl += t.pnl;
        if (t.pnl > 0) symbolStats[t.symbol].wins++;
      });

      // Return JSON data for client-side PDF generation
      const dateRange = startDate && endDate 
        ? `${new Date(startDate as string).toLocaleDateString()} - ${new Date(endDate as string).toLocaleDateString()}`
        : cutoffDate 
          ? `Last ${historyDays} days`
          : 'All time';

      const sortedSymbols = Object.entries(symbolStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([symbol, stats]) => ({
          symbol,
          count: stats.count,
          pnl: stats.pnl,
          winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0
        }));

      const sessionData = Object.entries(sessions)
        .filter(([_, count]) => count > 0)
        .map(([session, count]) => ({
          session,
          count,
          pnl: sessionPnL[session as keyof typeof sessionPnL],
          avgPnl: sessionPnL[session as keyof typeof sessionPnL] / count
        }));

      res.json({
        dateRange,
        generatedAt: new Date().toISOString(),
        dataSource: filteredMt5.length > 0 ? 'MT5 + Manual' : 'Manual',
        metrics: {
          totalTrades,
          wins: wins.length,
          losses: losses.length,
          breakeven: breakeven.length,
          winRate,
          profitFactor: profitFactor === Infinity ? 'Infinity' : profitFactor,
          expectancy,
          totalPnL,
          avgWin,
          avgLoss,
          bestTrade,
          worstTrade
        },
        sessionData,
        symbolData: sortedSymbols
      });

    } catch (error: any) {
      console.error("PDF Report Error:", error?.message || error);
      console.error("PDF Report Stack:", error?.stack);
      res.status(500).json({ message: "Failed to generate PDF report", error: error?.message });
    }
  });

  // Rate limiting for contact form (in-memory, simple implementation)
  const contactFormAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  const CONTACT_FORM_RATE_LIMIT = 5; // max attempts per hour
  const CONTACT_FORM_WINDOW = 60 * 60 * 1000; // 1 hour in ms

  function checkContactFormRateLimit(ip: string): boolean {
    const now = new Date();
    const attempt = contactFormAttempts.get(ip);
    
    if (!attempt) {
      contactFormAttempts.set(ip, { count: 1, lastAttempt: now });
      return true;
    }
    
    // Reset if window has passed
    if (now.getTime() - attempt.lastAttempt.getTime() > CONTACT_FORM_WINDOW) {
      contactFormAttempts.set(ip, { count: 1, lastAttempt: now });
      return true;
    }
    
    // Check if under limit
    if (attempt.count < CONTACT_FORM_RATE_LIMIT) {
      attempt.count++;
      attempt.lastAttempt = now;
      return true;
    }
    
    return false;
  }

  // Contact form endpoint (public - no auth required)
  app.post("/api/contact", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Rate limiting
      if (!checkContactFormRateLimit(clientIp)) {
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      
      const { name, email, subject, message } = req.body;
      
      // Validation
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      
      // Message length limit
      if (message.length > 5000) {
        return res.status(400).json({ message: "Message too long (max 5000 characters)" });
      }
      
      // Send notification to support
      await emailService.sendContactFormNotification(email, name, subject, message);
      
      // Send auto-reply to user
      await emailService.sendContactFormAutoReply(email, name);
      
      res.json({ success: true, message: "Your message has been sent. We'll get back to you soon." });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ message: "Failed to send message. Please try again." });
    }
  });

  // Email status endpoint (admin only)
  app.get("/api/admin/email-status", requireAdmin, async (req, res) => {
    try {
      const logs = emailService.getEmailLogs();
      const configured = emailService.isEmailConfigured();
      
      res.json({
        configured,
        recentLogs: logs.slice(-50), // Last 50 logs
        totalSent: logs.filter(l => l.success).length,
        totalFailed: logs.filter(l => !l.success).length,
      });
    } catch (error) {
      console.error("Email status error:", error);
      res.status(500).json({ message: "Failed to get email status" });
    }
  });

  // Education Hub - Lesson Progress Endpoints
  app.get("/api/education/progress", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const progress = await db.select().from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, userId));
      res.json(progress);
    } catch (error) {
      console.error("Lesson progress error:", error);
      res.status(500).json({ message: "Failed to get lesson progress" });
    }
  });

  app.post("/api/education/progress", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { lessonId, completed } = req.body;
      
      const existing = await db.select().from(schema.lessonProgress)
        .where(and(eq(schema.lessonProgress.userId, userId), eq(schema.lessonProgress.lessonId, lessonId)))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(schema.lessonProgress)
          .set({ completed, completedAt: completed ? new Date() : null })
          .where(and(eq(schema.lessonProgress.userId, userId), eq(schema.lessonProgress.lessonId, lessonId)));
      } else {
        await db.insert(schema.lessonProgress).values({
          userId,
          lessonId,
          completed,
          completedAt: completed ? new Date() : null,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Lesson progress update error:", error);
      res.status(500).json({ message: "Failed to update lesson progress" });
    }
  });

  // Education Hub - Bookmark Endpoints
  app.get("/api/education/bookmarks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const bookmarks = await db.select().from(schema.lessonBookmarks).where(eq(schema.lessonBookmarks.userId, userId));
      res.json(bookmarks);
    } catch (error) {
      console.error("Bookmarks error:", error);
      res.status(500).json({ message: "Failed to get bookmarks" });
    }
  });

  app.post("/api/education/bookmarks", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { lessonId } = req.body;
      
      const existing = await db.select().from(schema.lessonBookmarks)
        .where(and(eq(schema.lessonBookmarks.userId, userId), eq(schema.lessonBookmarks.lessonId, lessonId)))
        .limit(1);
      
      if (existing.length > 0) {
        res.json({ success: true, message: "Already bookmarked" });
        return;
      }
      
      await db.insert(schema.lessonBookmarks).values({ userId, lessonId });
      res.json({ success: true });
    } catch (error) {
      console.error("Bookmark add error:", error);
      res.status(500).json({ message: "Failed to add bookmark" });
    }
  });

  app.delete("/api/education/bookmarks/:lessonId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const lessonId = parseInt(req.params.lessonId);
      
      await db.delete(schema.lessonBookmarks)
        .where(and(eq(schema.lessonBookmarks.userId, userId), eq(schema.lessonBookmarks.lessonId, lessonId)));
      res.json({ success: true });
    } catch (error) {
      console.error("Bookmark delete error:", error);
      res.status(500).json({ message: "Failed to remove bookmark" });
    }
  });

  // Education Hub - Quiz Results Endpoints
  app.get("/api/education/quiz-results", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const results = await db.select().from(schema.quizResults).where(eq(schema.quizResults.userId, userId));
      res.json(results);
    } catch (error) {
      console.error("Quiz results error:", error);
      res.status(500).json({ message: "Failed to get quiz results" });
    }
  });

  app.post("/api/education/quiz-results", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { lessonId, score, totalQuestions, answers } = req.body;
      
      await db.insert(schema.quizResults).values({
        userId,
        lessonId,
        score,
        totalQuestions,
        answers: answers || {},
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Quiz result save error:", error);
      res.status(500).json({ message: "Failed to save quiz result" });
    }
  });

  app.get("/api/education/quiz-results/:lessonId/best", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const lessonId = parseInt(req.params.lessonId);
      
      const results = await db.select().from(schema.quizResults)
        .where(and(eq(schema.quizResults.userId, userId), eq(schema.quizResults.lessonId, lessonId)))
        .orderBy(desc(schema.quizResults.score))
        .limit(1);
      
      res.json(results[0] || null);
    } catch (error) {
      console.error("Best quiz result error:", error);
      res.status(500).json({ message: "Failed to get best quiz result" });
    }
  });

  app.post("/api/education/ai-tutor", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      
      const aiTutorSchema = z.object({
        question: z.string().min(1).max(500),
        lessonTitle: z.string().min(1).max(200),
        lessonContent: z.string().max(5000).optional(),
      });
      
      const validationResult = aiTutorSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({ message: "Invalid request data" });
        return;
      }
      
      const { question, lessonTitle, lessonContent } = validationResult.data;
      
      const user = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, userId)).limit(1);
      const userPlan = user[0]?.subscriptionTier || "FREE";
      
      if (!canAccessFeature(userPlan, "aiAnalysis")) {
        res.status(403).json({ message: "AI Tutor is a Pro/Elite feature. Upgrade to access." });
        return;
      }
      
      const systemPrompt = `${AI_SYSTEM_CONTEXT}

You are an AI Trading Tutor for the TRADIFY trading journal application. You help traders understand trading concepts from their educational lessons.

Current Lesson: "${lessonTitle}"
${lessonContent ? `\nLesson Context:\n${lessonContent.slice(0, 2000)}` : ""}

Trading Knowledge Context:
${TRADING_KNOWLEDGE_CONTEXT}

Guidelines:
- Answer questions specifically about the current lesson topic
- Provide practical examples when helpful
- Keep responses concise (2-4 paragraphs max)
- Use trading terminology the student is learning
- If asked about unrelated topics, gently redirect to trading education
- Never provide specific trade recommendations or financial advice
- Focus on concepts, not predictions`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });
      
      const answer = response.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
      
      res.json({ answer });
    } catch (error) {
      console.error("AI Tutor error:", error);
      res.status(500).json({ message: "Failed to get AI response. Please try again." });
    }
  });

  // ==================== PROP FIRM CHALLENGE ENDPOINTS ====================

  // Get MT5 accounts with balance data for prop firm challenge creation
  app.get("/api/prop-firm/mt5-accounts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const accounts = await storage.getMT5Accounts(userId);
      
      const accountsWithData = await Promise.all(
        accounts.map(async (account: any) => {
          const [mt5DataRow] = await db.select().from(schema.mt5Data)
            .where(and(
              eq(schema.mt5Data.userId, userId),
              eq(schema.mt5Data.mt5AccountId, account.accountNumber)
            ))
            .limit(1);
          
          return {
            accountNumber: account.accountNumber,
            accountName: account.accountName || `Account ${account.accountNumber}`,
            broker: account.broker,
            server: account.server,
            currency: account.currency || "USD",
            isActive: account.isActive,
            balance: mt5DataRow ? mt5DataRow.balance : null,
            equity: mt5DataRow ? mt5DataRow.equity : null,
            lastSync: mt5DataRow ? mt5DataRow.lastUpdate : null,
            isOnline: mt5DataRow?.lastUpdate 
              ? (Date.now() - new Date(mt5DataRow.lastUpdate).getTime()) < 45000
              : false,
          };
        })
      );
      
      res.json(accountsWithData);
    } catch (error) {
      console.error("Error fetching MT5 accounts for prop firm:", error);
      res.status(500).json({ message: "Failed to fetch MT5 accounts" });
    }
  });

  // Get all challenges for the current user
  app.get("/api/prop-firm/challenges", requireAuth, async (req, res) => {
    try {
      const challenges = await db.select().from(schema.propFirmChallenges)
        .where(eq(schema.propFirmChallenges.userId, req.session.userId!))
        .orderBy(desc(schema.propFirmChallenges.createdAt));
      res.json(challenges);
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  // Get single challenge with full progress data
  app.get("/api/prop-firm/challenges/:id", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const [challenge] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, challengeId),
          eq(schema.propFirmChallenges.userId, req.session.userId!)
        ));
      
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // Get daily stats
      const dailyStats = await db.select().from(schema.propFirmDailyStats)
        .where(eq(schema.propFirmDailyStats.challengeId, challengeId))
        .orderBy(schema.propFirmDailyStats.date);

      // Calculate progress metrics
      const accountSize = parseFloat(challenge.accountSize);
      const currentBalance = parseFloat(challenge.currentBalance || challenge.accountSize);
      const highWaterMark = parseFloat(challenge.highWaterMark || challenge.accountSize);
      const profitTarget = parseFloat(challenge.profitTarget);
      const dailyDDLimit = parseFloat(challenge.dailyDrawdownLimit);
      const maxDDLimit = parseFloat(challenge.maxDrawdownLimit);

      // Profit progress
      const profitTargetAmount = accountSize * (profitTarget / 100);
      const currentProfit = currentBalance - accountSize;
      const profitProgress = profitTargetAmount > 0 ? Math.min((currentProfit / profitTargetAmount) * 100, 100) : 0;

      // Trailing drawdown calculations
      const trailingDDFloor = challenge.trailingDrawdown
        ? highWaterMark * (1 - maxDDLimit / 100)
        : accountSize * (1 - maxDDLimit / 100);
      const maxDDRemaining = currentBalance - trailingDDFloor;
      const maxDDUsedPercent = ((highWaterMark - currentBalance) / (highWaterMark * (maxDDLimit / 100))) * 100;

      // Daily drawdown for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStat = dailyStats.find(s => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
      const dailyStartBalance = todayStat ? parseFloat(todayStat.startingBalance) : currentBalance;
      const dailyDDAmount = dailyStartBalance * (dailyDDLimit / 100);
      const dailyLoss = Math.max(0, dailyStartBalance - currentBalance);
      const dailyDDUsedPercent = dailyDDAmount > 0 ? (dailyLoss / dailyDDAmount) * 100 : 0;

      // Trading days
      const uniqueTradingDays = new Set(dailyStats.filter(s => parseInt(s.tradesCount?.toString() || "0") > 0).map(s => {
        const d = new Date(s.date);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })).size;

      // Days remaining
      const startDate = new Date(challenge.startDate);
      const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
      const daysElapsed = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = endDate ? Math.max(0, Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

      // Consistency check
      let consistencyScore = 100;
      let worstDayProfitPercent = 0;
      const maxAllowedPct = parseFloat(challenge.maxDayProfitPercent || "40");
      let todayPl = 0;
      let consistencyTodayUsed = 0;
      let consistencyMaxAllowedAmount = 0;
      if (challenge.consistencyRule) {
        const totalProfit = dailyStats.length > 0
          ? dailyStats.reduce((sum, s) => sum + Math.max(0, parseFloat(s.dayPl)), 0)
          : 0;
        consistencyMaxAllowedAmount = accountSize * (maxAllowedPct / 100);
        if (totalProfit > 0 && dailyStats.length > 0) {
          const maxDayProfit = Math.max(...dailyStats.map(s => Math.max(0, parseFloat(s.dayPl))));
          worstDayProfitPercent = (maxDayProfit / totalProfit) * 100;
          consistencyScore = Math.min(100, (maxAllowedPct / Math.max(worstDayProfitPercent, 1)) * 100);
        }
      }
      if (todayStat) {
        todayPl = parseFloat(todayStat.dayPl) || 0;
        if (challenge.consistencyRule) {
          consistencyTodayUsed = Math.max(0, todayPl);
        }
      }

      // Rule violation events
      const ruleEvents: { date: string; event: string; severity: string }[] = [];
      for (const stat of dailyStats) {
        const statStartBal = parseFloat(stat.startingBalance);
        const statEndBal = parseFloat(stat.endingBalance);
        const statDate = new Date(stat.date).toLocaleDateString();
        const statDailyLoss = Math.max(0, statStartBal - statEndBal);
        const statDailyDDLimit = statStartBal * (dailyDDLimit / 100);
        const dailyUsagePct = statDailyDDLimit > 0 ? (statDailyLoss / statDailyDDLimit) * 100 : 0;
        if (dailyUsagePct >= 80) {
          ruleEvents.push({
            date: statDate,
            event: `Daily DD reached ${dailyUsagePct.toFixed(0)}%`,
            severity: dailyUsagePct >= 100 ? "critical" : "warning",
          });
        }
        if (challenge.trailingDrawdown) {
          const statHWM = parseFloat(challenge.highWaterMark || challenge.accountSize);
          const floor = statHWM * (1 - maxDDLimit / 100);
          const buffer = statEndBal - floor;
          if (buffer < accountSize * 0.01) {
            ruleEvents.push({
              date: statDate,
              event: `Trailing DD buffer critically low ($${buffer.toFixed(0)})`,
              severity: "critical",
            });
          }
        }
        if (challenge.consistencyRule && parseFloat(stat.dayPl) > 0) {
          const dayProfitPct = (parseFloat(stat.dayPl) / accountSize) * 100;
          if (dayProfitPct > maxAllowedPct) {
            ruleEvents.push({
              date: statDate,
              event: `Day profit (${dayProfitPct.toFixed(1)}%) exceeded max allowed (${maxAllowedPct}%)`,
              severity: "warning",
            });
          }
        }
      }

      // Pass eligibility
      const profitTargetMet = currentProfit >= profitTargetAmount;
      const minDaysMet = uniqueTradingDays >= (challenge.minTradingDays || 0);
      const noRuleBreach = maxDDRemaining > 0 && dailyDDUsedPercent < 100;
      const passEligible = profitTargetMet && minDaysMet && noRuleBreach;
      const failTriggered = maxDDRemaining <= 0;

      // Distance-to metrics
      const distanceToProfitTarget = profitTargetAmount - currentProfit;
      const distanceToMaxLoss = maxDDRemaining;
      const distanceToDailyDDLimit = Math.max(0, dailyDDAmount - dailyLoss);

      // Challenge health status
      let healthStatus: "healthy" | "caution" | "at_risk" = "healthy";
      let healthMessage = "Challenge Healthy - All rules intact";
      if (failTriggered) {
        healthStatus = "at_risk";
        healthMessage = "FAILED - Max drawdown breached";
      } else if (maxDDRemaining < accountSize * 0.01) {
        healthStatus = "at_risk";
        healthMessage = `At Risk - ${challenge.trailingDrawdown ? "Trailing" : "Max"} DD buffer below $${maxDDRemaining.toFixed(0)}`;
      } else if (dailyDDUsedPercent > 70) {
        healthStatus = dailyDDUsedPercent > 90 ? "at_risk" : "caution";
        healthMessage = dailyDDUsedPercent > 90
          ? `At Risk - ${dailyDDUsedPercent.toFixed(0)}% of daily drawdown used`
          : `Caution - ${(100 - dailyDDUsedPercent).toFixed(0)}% of daily drawdown remaining`;
      } else if (daysRemaining !== null && daysRemaining <= 3 && !profitTargetMet) {
        healthStatus = "caution";
        healthMessage = `Caution - Only ${daysRemaining} days remaining, profit target not met`;
      }

      res.json({
        challenge,
        dailyStats,
        progress: {
          currentBalance,
          currentProfit,
          profitTargetAmount,
          profitProgress: Math.max(0, profitProgress),
          highWaterMark,
          trailingDDFloor,
          maxDDRemaining: Math.max(0, maxDDRemaining),
          maxDDUsedPercent: Math.max(0, Math.min(100, maxDDUsedPercent)),
          dailyDDUsedPercent: Math.max(0, Math.min(100, dailyDDUsedPercent)),
          dailyDDRemaining: Math.max(0, dailyDDAmount - dailyLoss),
          dailyDDAmount,
          dailyStartBalance,
          uniqueTradingDays,
          minTradingDays: challenge.minTradingDays || 0,
          daysElapsed,
          daysRemaining,
          consistencyScore,
          worstDayProfitPercent,
          consistencyTodayUsed,
          consistencyMaxAllowedAmount,
          todayPl,
          distanceToProfitTarget,
          distanceToMaxLoss,
          distanceToDailyDDLimit,
          healthStatus,
          healthMessage,
          passEligible,
          failTriggered,
          profitTargetMet,
          minDaysMet,
          ruleEvents: ruleEvents.slice(-10),
          status: challenge.status,
        },
      });
    } catch (error) {
      console.error("Error fetching challenge details:", error);
      res.status(500).json({ message: "Failed to fetch challenge details" });
    }
  });

  // Create a new challenge
  app.post("/api/prop-firm/challenges", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      
      if (!data.firmName || !data.challengeName || !data.accountSize || !data.profitTarget || !data.dailyDrawdownLimit || !data.maxDrawdownLimit) {
        return res.status(400).json({ message: "Missing required fields: firmName, challengeName, accountSize, profitTarget, dailyDrawdownLimit, maxDrawdownLimit" });
      }
      if (!data.startDate) {
        return res.status(400).json({ message: "Start date is required" });
      }
      
      const [challenge] = await db.insert(schema.propFirmChallenges).values({
        userId: String(req.session.userId!),
        firmName: data.firmName,
        challengeName: data.challengeName,
        phase: data.phase || "Phase 1",
        accountSize: String(data.accountSize),
        currency: data.currency || "USD",
        profitTarget: String(data.profitTarget),
        dailyDrawdownLimit: String(data.dailyDrawdownLimit),
        maxDrawdownLimit: String(data.maxDrawdownLimit),
        trailingDrawdown: data.trailingDrawdown || false,
        drawdownType: data.drawdownType || "static",
        trailingStopBehavior: data.trailingStopBehavior || "always_trails",
        phaseLink: data.phaseLink || false,
        minTradingDays: data.minTradingDays || 0,
        maxTradingDays: data.maxTradingDays || null,
        consistencyRule: data.consistencyRule || false,
        maxDayProfitPercent: data.maxDayProfitPercent || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: "active",
        currentBalance: String(data.accountSize),
        highWaterMark: String(data.accountSize),
        mt5AccountId: data.mt5AccountId || null,
        mt5AutoSync: data.mt5AutoSync || false,
      }).returning();
      res.status(201).json(challenge);
    } catch (error: any) {
      console.error("Error creating challenge:", error?.message || error, error?.stack);
      res.status(500).json({ message: error?.message || "Failed to create challenge" });
    }
  });

  // Update challenge (balance, status, etc.)
  app.patch("/api/prop-firm/challenges/:id", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const data = req.body;
      
      const [existing] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, challengeId),
          eq(schema.propFirmChallenges.userId, req.session.userId!)
        ));
      
      if (!existing) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (data.status) updateData.status = data.status;
      if (data.currentBalance) {
        updateData.currentBalance = data.currentBalance;
        const newBalance = parseFloat(data.currentBalance);
        const currentHWM = parseFloat(existing.highWaterMark || existing.accountSize);
        if (newBalance > currentHWM) {
          updateData.highWaterMark = data.currentBalance;
        }
      }
      if (data.challengeName) updateData.challengeName = data.challengeName;
      if (data.phase) updateData.phase = data.phase;

      const [updated] = await db.update(schema.propFirmChallenges)
        .set(updateData)
        .where(eq(schema.propFirmChallenges.id, challengeId))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating challenge:", error);
      res.status(500).json({ message: "Failed to update challenge" });
    }
  });

  // Delete a challenge
  app.delete("/api/prop-firm/challenges/:id", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      await db.delete(schema.propFirmDailyStats)
        .where(eq(schema.propFirmDailyStats.challengeId, challengeId));
      await db.delete(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, challengeId),
          eq(schema.propFirmChallenges.userId, req.session.userId!)
        ));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting challenge:", error);
      res.status(500).json({ message: "Failed to delete challenge" });
    }
  });

  // Record daily stats for a challenge
  app.post("/api/prop-firm/challenges/:id/daily-stat", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const { date, startingBalance, endingBalance, dayPl, tradesCount } = req.body;
      
      const [challenge] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, challengeId),
          eq(schema.propFirmChallenges.userId, req.session.userId!)
        ));
      
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      const newBalance = parseFloat(endingBalance);
      const currentHWM = parseFloat(challenge.highWaterMark || challenge.accountSize);
      const newHWM = Math.max(currentHWM, newBalance);

      const [stat] = await db.insert(schema.propFirmDailyStats).values({
        challengeId,
        userId: req.session.userId!,
        date: new Date(date),
        startingBalance,
        endingBalance,
        dayPl,
        tradesCount: tradesCount || 0,
        dailyDrawdownUsed: String(Math.max(0, parseFloat(startingBalance) - newBalance)),
        highWaterMark: String(newHWM),
      }).returning();

      // Update challenge balance and HWM
      await db.update(schema.propFirmChallenges)
        .set({
          currentBalance: endingBalance,
          highWaterMark: String(newHWM),
          updatedAt: new Date(),
        })
        .where(eq(schema.propFirmChallenges.id, challengeId));

      res.status(201).json(stat);
    } catch (error) {
      console.error("Error recording daily stat:", error);
      res.status(500).json({ message: "Failed to record daily stat" });
    }
  });

  // Get active challenge for current user (for trade logging integration)
  app.get("/api/prop-firm/active-challenge", requireAuth, async (req, res) => {
    try {
      const [challenge] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.userId, req.session.userId!),
          eq(schema.propFirmChallenges.status, "active")
        ))
        .orderBy(desc(schema.propFirmChallenges.createdAt))
        .limit(1);
      
      if (!challenge) {
        return res.json(null);
      }
      res.json(challenge);
    } catch (error) {
      console.error("Error fetching active challenge:", error);
      res.status(500).json({ message: "Failed to fetch active challenge" });
    }
  });

  // AI Risk Analysis for trade against active challenge
  app.post("/api/prop-firm/ai-risk-check", requireAuth, async (req, res) => {
    try {
      const { challengeId, tradeDirection, pair, entryPrice, stopLoss, lotSize, currentPl } = req.body;
      
      const [challenge] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, parseInt(challengeId)),
          eq(schema.propFirmChallenges.userId, req.session.userId!)
        ));
      
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      const accountSize = parseFloat(challenge.accountSize);
      const currentBalance = parseFloat(challenge.currentBalance || challenge.accountSize);
      const highWaterMark = parseFloat(challenge.highWaterMark || challenge.accountSize);
      const dailyDDLimit = parseFloat(challenge.dailyDrawdownLimit);
      const maxDDLimit = parseFloat(challenge.maxDrawdownLimit);
      const profitTarget = parseFloat(challenge.profitTarget);

      const profitTargetAmount = accountSize * (profitTarget / 100);
      const currentProfit = currentBalance - accountSize;
      const remainingToTarget = profitTargetAmount - currentProfit;

      // Calculate risk from proposed trade
      const entry = parseFloat(entryPrice || "0");
      const sl = parseFloat(stopLoss || "0");
      const lots = parseFloat(lotSize || "0.01");
      let potentialLoss = 0;

      const getContractMultiplier = (symbol: string): number => {
        const s = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (s.includes("XAUUSD") || s.includes("GOLD")) return 100;
        if (s.includes("XAGUSD") || s.includes("SILVER")) return 5000;
        if (s.includes("XTIUSD") || s.includes("USOIL") || s.includes("WTIUSD") || s.includes("CL")) return 1000;
        if (s.includes("XBRUSD") || s.includes("BRENT") || s.includes("UKOUSD")) return 1000;
        if (s.includes("XNGUSD") || s.includes("NATGAS") || s.includes("NGAS")) return 10000;
        if (s.includes("US30") || s.includes("DJ30") || s.includes("DJI")) return 1;
        if (s.includes("US500") || s.includes("SP500") || s.includes("SPX500")) return 1;
        if (s.includes("NAS100") || s.includes("USTEC") || s.includes("NDX")) return 1;
        if (s.includes("US2000") || s.includes("RUSSELL")) return 1;
        if (s.includes("DE30") || s.includes("DE40") || s.includes("GER40") || s.includes("DAX")) return 1;
        if (s.includes("UK100") || s.includes("FTSE")) return 1;
        if (s.includes("JP225") || s.includes("JPN225") || s.includes("NIKKEI")) return 1;
        if (s.includes("BTCUSD") || s.includes("BITCOIN")) return 1;
        if (s.includes("ETHUSD") || s.includes("ETHEREUM")) return 1;
        if (s.includes("JPY")) return 1000;
        return 100000;
      }

      if (entry && sl) {
        const priceDiff = Math.abs(entry - sl);
        const multiplier = getContractMultiplier(pair);
        potentialLoss = priceDiff * lots * multiplier;
      }

      // Daily drawdown check
      const dailyStats = await db.select().from(schema.propFirmDailyStats)
        .where(eq(schema.propFirmDailyStats.challengeId, challenge.id))
        .orderBy(desc(schema.propFirmDailyStats.date))
        .limit(1);
      
      const todayStartBalance = dailyStats.length > 0 ? parseFloat(dailyStats[0].startingBalance) : currentBalance;
      const dailyDDAmount = todayStartBalance * (dailyDDLimit / 100);
      const todayLoss = Math.max(0, todayStartBalance - currentBalance) + (parseFloat(currentPl || "0") < 0 ? Math.abs(parseFloat(currentPl || "0")) : 0);
      const dailyDDRemaining = dailyDDAmount - todayLoss;
      const dailyDDUsedPercent = (todayLoss / dailyDDAmount) * 100;

      // Max/trailing drawdown check
      const trailingDDFloor = challenge.trailingDrawdown
        ? highWaterMark * (1 - maxDDLimit / 100)
        : accountSize * (1 - maxDDLimit / 100);
      const maxDDRemaining = currentBalance - trailingDDFloor;

      const warnings: { level: string; message: string; suggestion?: string }[] = [];

      // Check if potential loss would breach daily DD
      if (potentialLoss > 0 && potentialLoss > dailyDDRemaining) {
        warnings.push({
          level: "critical",
          message: `This trade risks $${potentialLoss.toFixed(2)} but you only have $${dailyDDRemaining.toFixed(2)} daily drawdown remaining.`,
          suggestion: `Reduce lot size to ${(lots * (dailyDDRemaining / potentialLoss) * 0.7).toFixed(2)} lots or tighten your stop-loss.`,
        });
      } else if (potentialLoss > 0 && potentialLoss > dailyDDRemaining * 0.6) {
        warnings.push({
          level: "warning",
          message: `This trade uses ${((potentialLoss / dailyDDRemaining) * 100).toFixed(0)}% of your remaining daily drawdown ($${dailyDDRemaining.toFixed(2)} left).`,
          suggestion: "Consider reducing position size to preserve daily drawdown buffer.",
        });
      }

      // Check if potential loss would breach max DD
      if (potentialLoss > 0 && potentialLoss > maxDDRemaining) {
        warnings.push({
          level: "critical",
          message: `This trade risks $${potentialLoss.toFixed(2)} but max drawdown only allows $${maxDDRemaining.toFixed(2)} more loss before breach.`,
          suggestion: "STOP trading or significantly reduce your position size.",
        });
      } else if (potentialLoss > 0 && potentialLoss > maxDDRemaining * 0.5) {
        warnings.push({
          level: "warning",
          message: `This trade would use ${((potentialLoss / maxDDRemaining) * 100).toFixed(0)}% of your remaining max drawdown buffer.`,
          suggestion: `Tighten SL to limit risk to under $${(maxDDRemaining * 0.3).toFixed(2)}.`,
        });
      }

      // Daily DD usage warning
      if (dailyDDUsedPercent > 70) {
        warnings.push({
          level: dailyDDUsedPercent > 90 ? "critical" : "warning",
          message: `You've used ${dailyDDUsedPercent.toFixed(0)}% of today's daily drawdown limit.`,
          suggestion: dailyDDUsedPercent > 90 ? "Stop trading for today to protect your challenge." : "Be very selective with remaining trades today.",
        });
      }

      // Near profit target
      if (remainingToTarget > 0 && remainingToTarget < profitTargetAmount * 0.15) {
        warnings.push({
          level: "info",
          message: `You're ${((currentProfit / profitTargetAmount) * 100).toFixed(0)}% to your profit target! Only $${remainingToTarget.toFixed(2)} to go.`,
          suggestion: "Protect your gains with tighter risk management. Don't give back profits near the finish line.",
        });
      }

      // Calculate suggested max SL
      let suggestedMaxSL = null;
      if (entry && lots > 0) {
        const safeRisk = Math.min(dailyDDRemaining * 0.3, maxDDRemaining * 0.2);
        const multiplier = getContractMultiplier(pair);
        const safePriceDistance = safeRisk / (lots * multiplier);

        const s = (pair || "").toUpperCase();
        let decimals = 5;
        if (s.includes("JPY") || s.includes("XAU") || s.includes("GOLD")) decimals = 2;
        else if (s.includes("XAG") || s.includes("SILVER")) decimals = 3;
        else if (s.includes("US30") || s.includes("NAS") || s.includes("SP500") || s.includes("DE") || s.includes("UK100") || s.includes("JP225")) decimals = 1;
        else if (s.includes("BTC") || s.includes("ETH")) decimals = 2;

        if (tradeDirection === "Long" || tradeDirection === "Buy") {
          suggestedMaxSL = (entry - safePriceDistance).toFixed(decimals);
        } else {
          suggestedMaxSL = (entry + safePriceDistance).toFixed(decimals);
        }
      }

      res.json({
        warnings,
        metrics: {
          dailyDDUsedPercent: Math.min(100, dailyDDUsedPercent),
          dailyDDRemaining,
          maxDDRemaining,
          maxDDUsedPercent: Math.min(100, ((highWaterMark - currentBalance) / (highWaterMark * (maxDDLimit / 100))) * 100),
          potentialLoss,
          profitProgress: Math.min(100, (currentProfit / profitTargetAmount) * 100),
          currentProfit,
          remainingToTarget,
          suggestedMaxSL,
        },
      });
    } catch (error) {
      console.error("AI risk check error:", error);
      res.status(500).json({ message: "Failed to analyze trade risk" });
    }
  });

  // Auto-analyze MT5 open positions against linked challenge
  app.get("/api/prop-firm/mt5-risk/:challengeId", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.challengeId);
      const userId = req.session.userId!;

      const [challenge] = await db.select().from(schema.propFirmChallenges)
        .where(and(
          eq(schema.propFirmChallenges.id, challengeId),
          eq(schema.propFirmChallenges.userId, userId)
        ));

      if (!challenge || !challenge.mt5AccountId) {
        return res.status(404).json({ message: "No MT5-linked challenge found" });
      }

      // Get MT5 live data with open positions
      const [mt5DataRow] = await db.select().from(schema.mt5Data)
        .where(and(
          eq(schema.mt5Data.userId, userId),
          eq(schema.mt5Data.mt5AccountId, challenge.mt5AccountId)
        ))
        .limit(1);

      if (!mt5DataRow) {
        return res.json({ positions: [], warnings: [], connected: false });
      }

      const isOnline = mt5DataRow.lastUpdate
        ? (Date.now() - new Date(mt5DataRow.lastUpdate).getTime()) < 45000
        : false;

      const positions = Array.isArray(mt5DataRow.positions) ? mt5DataRow.positions as any[] : [];
      const floatingPl = parseFloat(mt5DataRow.floatingPl || "0");

      const accountSize = parseFloat(challenge.accountSize);
      const currentBalance = parseFloat(challenge.currentBalance || challenge.accountSize);
      const highWaterMark = parseFloat(challenge.highWaterMark || challenge.accountSize);
      const dailyDDLimit = parseFloat(challenge.dailyDrawdownLimit);
      const maxDDLimit = parseFloat(challenge.maxDrawdownLimit);

      // Get today's starting balance
      const dailyStats = await db.select().from(schema.propFirmDailyStats)
        .where(eq(schema.propFirmDailyStats.challengeId, challenge.id))
        .orderBy(desc(schema.propFirmDailyStats.date))
        .limit(1);
      const todayStartBalance = dailyStats.length > 0 ? parseFloat(dailyStats[0].startingBalance) : currentBalance;

      // Calculate current risk exposure
      const dailyDDAmount = dailyDDLimit > 0 ? todayStartBalance * (dailyDDLimit / 100) : 0;
      const currentDailyLoss = Math.max(0, todayStartBalance - currentBalance) + (floatingPl < 0 ? Math.abs(floatingPl) : 0);
      const dailyDDRemaining = dailyDDAmount > 0 ? dailyDDAmount - currentDailyLoss : 0;
      const dailyDDUsedPercent = dailyDDAmount > 0 ? (currentDailyLoss / dailyDDAmount) * 100 : 0;

      const trailingDDFloor = challenge.trailingDrawdown
        ? highWaterMark * (1 - maxDDLimit / 100)
        : accountSize * (1 - maxDDLimit / 100);
      const maxDDRemaining = (currentBalance + floatingPl) - trailingDDFloor;

      const warnings: { level: string; message: string; suggestion?: string }[] = [];

      // Floating P&L warning
      if (floatingPl < 0 && dailyDDAmount > 0) {
        const absFloating = Math.abs(floatingPl);
        if (absFloating > dailyDDRemaining) {
          warnings.push({
            level: "critical",
            message: `Open positions are floating -$${absFloating.toFixed(2)}, exceeding daily DD remaining ($${dailyDDRemaining.toFixed(2)}).`,
            suggestion: "Close losing positions immediately to protect your challenge.",
          });
        } else if (absFloating > dailyDDRemaining * 0.5) {
          warnings.push({
            level: "warning",
            message: `Open positions are floating -$${absFloating.toFixed(2)} (${((absFloating / dailyDDAmount) * 100).toFixed(0)}% of daily DD limit).`,
            suggestion: "Monitor closely. Consider partial closes or tightening stop-losses.",
          });
        }

        if (absFloating > maxDDRemaining * 0.7) {
          warnings.push({
            level: "critical",
            message: `Floating loss ($${absFloating.toFixed(2)}) is approaching max drawdown limit ($${maxDDRemaining.toFixed(2)} remaining).`,
            suggestion: "Reduce exposure immediately to avoid challenge failure.",
          });
        }
      }

      if (positions.length === 0 && floatingPl === 0) {
        warnings.push({
          level: "info",
          message: "No open positions. You're safe.",
        });
      }

      res.json({
        connected: isOnline,
        lastSync: mt5DataRow.lastUpdate,
        floatingPl,
        equity: mt5DataRow.equity,
        positionsCount: positions.length,
        positions: positions.slice(0, 10).map((p: any) => ({
          symbol: p.symbol,
          direction: p.type === 0 ? "Buy" : "Sell",
          volume: p.volume,
          profit: p.profit,
          openPrice: p.openPrice,
          sl: p.sl,
          tp: p.tp,
        })),
        warnings,
        metrics: {
          dailyDDUsedPercent: Math.min(100, dailyDDUsedPercent),
          dailyDDRemaining,
          maxDDRemaining,
        },
      });
    } catch (error) {
      console.error("MT5 risk analysis error:", error);
      res.status(500).json({ message: "Failed to analyze MT5 positions" });
    }
  });

  return httpServer;
}

async function seedDatabase() {
  // Ensure admin user has a password if it doesn't
  const adminEmail = "mohammad@admin.com";
  const [admin] = await db.select().from(schema.userRole).where(eq(schema.userRole.userId, adminEmail)).limit(1);
  if (admin && !admin.password) {
    const hashedPassword = await bcrypt.hash("Admin123!", 10);
    await db.update(schema.userRole).set({ password: hashedPassword }).where(eq(schema.userRole.userId, adminEmail));
    console.log("Seeded admin password");
  }

  const existingTrades = await storage.getTrades();
  if (existingTrades.length === 0) {
    await storage.createTrade({
      pair: "EURUSD",
      direction: "Short",
      timeframe: "M15",
      htfBias: "Bearish",
      structureState: "BOS",
      liquidityStatus: "Taken",
      zoneValidity: "Valid",
      htfBiasClear: true,
      zoneValid: true,
      liquidityTaken: true,
      structureConfirmed: true,
      entryConfirmed: true,
      entryPrice: "1.0850",
      stopLoss: "1.0870",
      takeProfit: "1.0800",
      riskReward: "2.5",
      outcome: "Win",
      notes: "Perfect textbook setup. Liquidity sweep of Asian high, displacement down, entered on FVG retest."
    });
  }
}
