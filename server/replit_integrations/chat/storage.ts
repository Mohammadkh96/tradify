import { db } from "../../db";
import { aiPerformanceInsights, aiInsightLogs } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof aiPerformanceInsights.$inferSelect | undefined>;
  getAllConversations(): Promise<(typeof aiPerformanceInsights.$inferSelect)[]>;
  createConversation(title: string): Promise<typeof aiPerformanceInsights.$inferSelect>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof aiInsightLogs.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof aiInsightLogs.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(aiPerformanceInsights).where(eq(aiPerformanceInsights.id, id));
    return conversation;
  },

  async getAllConversations() {
    return db.select().from(aiPerformanceInsights).orderBy(desc(aiPerformanceInsights.createdAt));
  },

  async createConversation(title: string) {
    // Note: Schema has userId as notNull, so we'd need that. 
    // This is a stub for the integration's expectations.
    const [conversation] = await db.insert(aiPerformanceInsights).values({ 
      userId: "system", 
      timeframe: "recent", 
      insightText: title,
      metadata: {} 
    }).returning();
    return conversation;
  },

  async deleteConversation(id: number) {
    await db.delete(aiInsightLogs).where(eq(aiInsightLogs.id, id)); // Rough mapping
    await db.delete(aiPerformanceInsights).where(eq(aiPerformanceInsights.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    // Mapping conversationId to userId for the stub
    return db.select().from(aiInsightLogs).where(eq(aiInsightLogs.id, conversationId)).orderBy(aiInsightLogs.timestamp);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(aiInsightLogs).values({ 
      userId: "system",
      prompt: role,
      response: content 
    }).returning();
    return message;
  },
};

