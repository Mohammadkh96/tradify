import { db } from "./db";
import {
  users,
  emailVerificationTokens,
  passwordResetTokens,
  trades,
  subscriptions,
  accountSettings,
  performanceAggregates,
  sessionPerformance,
  strategyTags,
  tradeStrategyTags,
  behavioralFlags,
  aiInsights,
  sentimentNarratives,
  auditLogs,
  errorLogs,
  type User,
  type InsertUser,
  type Trade,
  type InsertTrade,
  type Subscription,
  type AccountSettings,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(user: InsertUser & { passwordHash: string }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  // Auth Tokens
  createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getVerificationToken(token: string): Promise<any>;
  consumeVerificationToken(id: number): Promise<void>;
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(token: string): Promise<any>;
  consumePasswordResetToken(id: number): Promise<void>;

  // Trades
  getTrades(userId: string): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | undefined>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  
  // Audit & Logs
  createAuditLog(log: any): Promise<void>;
  logError(error: any): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async createUser(user: InsertUser & { passwordHash: string }): Promise<User> {
    const [newUser] = await db.insert(users).values({
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      role: "user",
      status: "active",
      country: user.country,
      phoneNumber: user.phoneNumber,
      timezone: user.timezone,
    }).returning();
    
    // Create default settings
    await db.insert(accountSettings).values({
      userId: newUser.id,
      theme: "dark",
      timezone: user.timezone || "UTC",
    });
    
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(emailVerificationTokens).values({ userId, token, expiresAt });
  }

  async getVerificationToken(token: string): Promise<any> {
    const [t] = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)).limit(1);
    return t;
  }

  async consumeVerificationToken(id: number): Promise<void> {
    await db.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, id));
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  }

  async getPasswordResetToken(token: string): Promise<any> {
    const [t] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
    return t;
  }

  async consumePasswordResetToken(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async getTrades(userId: string): Promise<Trade[]> {
    return await db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.createdAt));
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const [trade] = await db.select().from(trades).where(eq(trades.id, id)).limit(1);
    return trade;
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const [newTrade] = await db.insert(trades).values(trade).returning();
    return newTrade;
  }

  async createAuditLog(log: any): Promise<void> {
    await db.insert(auditLogs).values(log);
  }

  async logError(error: any): Promise<void> {
    await db.insert(errorLogs).values(error);
  }
}

export const storage = new DatabaseStorage();
