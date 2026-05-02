import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tradeJournal = pgTable("trade_journal", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("dev-user"),
  pair: text("pair").notNull(),
  direction: text("direction").notNull(),
  timeframe: text("timeframe").notNull(),
  htfBias: text("htf_bias").notNull(),
  htfBiasClear: boolean("htf_bias_clear").default(true),
  zoneValid: boolean("zone_valid").default(true),
  zoneValidity: text("zone_validity").default("Valid"),
  liquidityTaken: boolean("liquidity_taken").default(true),
  liquidityStatus: text("liquidity_status").default("Taken"),
  structureConfirmed: boolean("structure_confirmed").default(true),
  structureState: text("structure_state").default("BOS"),
  entryConfirmed: boolean("entry_confirmed").default(true),
  entryPrice: text("entry_price"),
  stopLoss: text("stop_loss"),
  takeProfit: text("take_profit"),
  riskReward: text("risk_reward"),
  netPl: text("net_pl"), // Added for unified P&L tracking
  outcome: text("outcome").notNull(),
  notes: text("notes"),
  isRuleCompliant: boolean("is_rule_compliant").default(true),
  violationReason: text("violation_reason"),
  matchedSetup: text("matched_setup"),
  mood: text("mood"),
  mistakeCategory: text("mistake_category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// MT5 Accounts table - tracks connected MT5 accounts per user
export const mt5Accounts = pgTable("mt5_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountNumber: text("account_number").notNull(), // MT5 login/account number
  accountName: text("account_name"), // Optional user-defined name (e.g., "Main Account", "Prop Firm")
  broker: text("broker"), // Broker name if available
  server: text("server"), // MT5 server name
  currency: text("currency").default("USD"),
  isActive: boolean("is_active").default(true), // Currently selected account
  createdAt: timestamp("created_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
});

export const mt5Data = pgTable("mt5_data", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mt5AccountId: text("mt5_account_id"), // Links to mt5_accounts.accountNumber
  balance: text("balance").notNull(),
  equity: text("equity").notNull(),
  margin: text("margin").notNull(),
  freeMargin: text("free_margin").notNull(),
  marginLevel: text("margin_level").notNull(),
  floatingPl: text("floating_pl").notNull(),
  leverage: integer("leverage").default(100),
  currency: text("currency").default("USD"),
  positions: jsonb("positions").default([]),
  syncToken: text("sync_token").notNull(),
  lastUpdate: timestamp("last_update").defaultNow(),
});

export const mt5History = pgTable("mt5_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mt5AccountId: text("mt5_account_id"),
  ticket: text("ticket").notNull(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  volume: text("volume").notNull(),
  entryPrice: text("entry_price").notNull(),
  exitPrice: text("exit_price").notNull(),
  sl: text("sl"),
  tp: text("tp"),
  openTime: timestamp("open_time").notNull(),
  closeTime: timestamp("close_time").notNull(),
  duration: integer("duration"),
  grossPl: text("gross_pl").notNull(),
  commission: text("commission").default("0"),
  swap: text("swap").default("0"),
  netPl: text("net_pl").notNull(),
  notes: text("notes"),
  tags: text("tags").array().default([]),
  mood: text("mood"),
  mistakeCategory: text("mistake_category"),
}, (table) => ({
  uniqueTicket: uniqueIndex("mt5_history_unique_ticket").on(table.userId, table.mt5AccountId, table.ticket),
}));

export const dailyEquitySnapshots = pgTable("daily_equity_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mt5AccountId: text("mt5_account_id"), // Links to mt5_accounts.accountNumber
  date: timestamp("date").notNull(),
  equity: text("equity").notNull(),
  balance: text("balance").notNull(),
});

export const userRole = pgTable("user_role", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  password: text("password"),
  role: text("role").notNull(),
  fullName: text("full_name"), // User's full name
  termsAccepted: boolean("terms_accepted").default(false),
  riskAcknowledged: boolean("risk_acknowledged").default(false),
  subscriptionTier: text("subscription_tier").default("FREE"),
  subscriptionStatus: text("subscription_status"),
  currentPlan: text("current_plan"),
  renewalDate: timestamp("renewal_date"),
  paypalSubscriptionId: text("paypal_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionProvider: text("subscription_provider"), // 'stripe' or 'paypal'
  billingPeriod: text("billing_period"), // 'monthly' or 'annual'
  syncToken: text("sync_token"),
  country: text("country"), // ISO country name or code as per spec
  phoneNumber: text("phone_number"),
  timezone: text("timezone"), // Added per spec
  mustResetPassword: boolean("must_reset_password").default(false), // For admin-created users
  emailVerified: boolean("email_verified").default(false), // Email verification status
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  hasSeenTour: boolean("has_seen_tour").default(false), // Onboarding tour completed
  foundingMember: boolean("founding_member").default(false), // Early adopter badge
  foundingMemberProExpiry: timestamp("founding_member_pro_expiry"), // When founding member free Pro access expires
  dashboardConfig: jsonb("dashboard_config"), // User's dashboard widget visibility/order preferences
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  emailUnsubscribed: boolean("email_unsubscribed").default(false),
  unsubscribeToken: text("unsubscribe_token"),
  language: text("language").default("en"),
  lastLoginAt: timestamp("last_login_at"),
  adminNotes: text("admin_notes"),
  adminTags: text("admin_tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Coach ↔ Student relationships (COACH tier feature) ──────────────────────
export const coachStudent = pgTable("coach_student", {
  id: serial("id").primaryKey(),
  coachId: text("coach_id").notNull(),
  studentId: text("student_id").notNull(),
  status: text("status").notNull().default("invited"), // invited | active | declined | removed
  inviteToken: text("invite_token"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  removedAt: timestamp("removed_at"),
});

export const coachFeedback = pgTable("coach_feedback", {
  id: serial("id").primaryKey(),
  coachId: text("coach_id").notNull(),
  studentId: text("student_id").notNull(),
  tradeId: integer("trade_id"), // nullable: null for general feedback
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCoachStudentSchema = createInsertSchema(coachStudent).omit({ id: true, invitedAt: true, acceptedAt: true, removedAt: true });
export type CoachStudent = typeof coachStudent.$inferSelect;
export type InsertCoachStudent = z.infer<typeof insertCoachStudentSchema>;

export const insertCoachFeedbackSchema = createInsertSchema(coachFeedback).omit({ id: true, createdAt: true });
export type CoachFeedback = typeof coachFeedback.$inferSelect;
export type InsertCoachFeedback = z.infer<typeof insertCoachFeedbackSchema>;

export const signalProviderProfile = pgTable("signal_provider_profile", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  providerName: text("provider_name").notNull(),
  bio: text("bio"),
  winRate: text("win_rate").default("0"),
  subscriberCount: integer("subscriber_count").default(0),
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const signalReceiver = pgTable("signal_receiver", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  receiverName: text("receiver_name").notNull(),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const providerSubscription = pgTable("provider_subscription", {
  id: serial("id").primaryKey(),
  receiverId: text("receiver_id").notNull(),
  providerId: text("provider_id").notNull(),
  subscriptionStatus: text("subscription_status").notNull(),
  externalPlatform: text("external_platform"),
  externalUserId: text("external_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

export const dispute = pgTable("dispute", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedProviderId: text("reported_provider_id").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("PENDING"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const platformDisclaimer = pgTable("platform_disclaimer", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  disclaimerVersion: text("disclaimer_version").notNull(),
  disclaimerText: text("disclaimer_text").notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

export const adminAccess = pgTable("admin_access", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  accessKey: text("access_key").notNull(),
  label: text("label"), // e.g. "Mohammad", "Support Team"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiPerformanceInsights = pgTable("ai_performance_insights", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  timeframe: text("timeframe").notNull(), // 'weekly', 'monthly', 'recent'
  insightText: text("insight_text").notNull(),
  metadata: jsonb("metadata"), // Input data summary for audit
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiInsightLogs = pgTable("ai_insight_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertAdminAccessSchema = createInsertSchema(adminAccess).omit({ id: true, createdAt: true });
export type AdminAccess = typeof adminAccess.$inferSelect;

export type AIPerformanceInsight = typeof aiPerformanceInsights.$inferSelect;
export type AIInsightLog = typeof aiInsightLogs.$inferSelect;

export const insertTradeSchema = createInsertSchema(tradeJournal).omit({ id: true, createdAt: true });
export const updateTradeSchema = insertTradeSchema.partial();
export type Trade = typeof tradeJournal.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type UpdateTradeRequest = z.infer<typeof updateTradeSchema>;
export type MT5Account = typeof mt5Accounts.$inferSelect;
export type InsertMT5Account = typeof mt5Accounts.$inferInsert;
export type MT5Data = typeof mt5Data.$inferSelect;
export type MT5History = typeof mt5History.$inferSelect;
export type DailySnapshot = typeof dailyEquitySnapshots.$inferSelect;

export const validationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  violations: z.array(z.string()).optional(),
  matchedSetup: z.string().optional(),
});
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  actionType: text("action_type").notNull(), // e.g. "DEACTIVATE", "GRANT_PRO", "SEND_EMAIL"
  targetUserId: text("target_user_id").notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const sentEmails = pgTable("sent_emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  recipient: varchar("recipient"),
  subject: varchar("subject").notNull(),
  templateName: varchar("template_name"), // email template type
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const insertSentEmailSchema = createInsertSchema(sentEmails).omit({ id: true, sentAt: true });
export type SentEmail = typeof sentEmails.$inferSelect;

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type InsertUserRole = typeof userRole.$inferInsert;

export const hubPosts = pgTable("hub_posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  symbol: text("symbol"),
  imageUrl: text("image_url"),
  type: text("type").notNull().default("Idea"), // Idea, Review, Commentary, Education
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hubComments = pgTable("hub_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hubReports = pgTable("hub_reports", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING, RESOLVED
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHubPostSchema = createInsertSchema(hubPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHubCommentSchema = createInsertSchema(hubComments).omit({ id: true, createdAt: true });
export const insertHubReportSchema = createInsertSchema(hubReports).omit({ id: true, createdAt: true });

export type HubPost = typeof hubPosts.$inferSelect;
export type HubComment = typeof hubComments.$inferSelect;
export type HubReport = typeof hubReports.$inferSelect;

// Early access signups for pre-launch marketing
export const earlyAccessSignups = pgTable("early_access_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  source: text("source").default("landing_page"), // Where they signed up from
  status: text("status").default("pending"), // pending, registered, converted
  registeredUserId: text("registered_user_id"), // Links to user when they complete signup
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEarlyAccessSchema = createInsertSchema(earlyAccessSignups).omit({ id: true, createdAt: true, registeredUserId: true });
export type EarlyAccessSignup = typeof earlyAccessSignups.$inferSelect;

// Founding member suggestions/feedback
export const foundingMemberSuggestions = pgTable("founding_member_suggestions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(), // feature, improvement, bug, other
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").default("pending"), // pending, reviewed, implemented, declined
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFoundingMemberSuggestionSchema = createInsertSchema(foundingMemberSuggestions).omit({ id: true, createdAt: true, status: true, adminNotes: true });
export type FoundingMemberSuggestion = typeof foundingMemberSuggestions.$inferSelect;

export const creatorProfiles = pgTable("creator_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  isVerified: boolean("is_verified").default(false),
  externalLink: text("external_link"),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, SUSPENDED
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creatorApplications = pgTable("creator_applications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  background: text("background").notNull(),
  contentFocus: text("content_focus").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, REJECTED
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCreatorProfileSchema = createInsertSchema(creatorProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreatorApplicationSchema = createInsertSchema(creatorApplications).omit({ id: true, createdAt: true });

export type CreatorProfile = typeof creatorProfiles.$inferSelect;
export type CreatorApplication = typeof creatorApplications.$inferSelect;

// ==================== STRATEGIES ====================
// User-defined trading frameworks with custom rules

export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const strategyRules = pgTable("strategy_rules", {
  id: serial("id").primaryKey(),
  strategyId: integer("strategy_id").notNull(),
  category: text("category").notNull(), // 'market_context' | 'execution' | 'risk'
  label: text("label").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(), // 'boolean' | 'select' | 'number' | 'text'
  options: jsonb("options"), // For select type: ["Option1", "Option2"]
  defaultValue: text("default_value"),
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStrategySchema = createInsertSchema(strategies).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStrategySchema = insertStrategySchema.partial();
export const insertStrategyRuleSchema = createInsertSchema(strategyRules).omit({ id: true, createdAt: true });

export type Strategy = typeof strategies.$inferSelect;
export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type StrategyRule = typeof strategyRules.$inferSelect;
export type InsertStrategyRule = z.infer<typeof insertStrategyRuleSchema>;

// ==================== COMPLIANCE EVALUATION ====================
// Deterministic rule evaluation results per trade

export const tradeComplianceResults = pgTable("trade_compliance_results", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(),
  strategyId: integer("strategy_id").notNull(),
  strategyName: text("strategy_name").notNull(),
  userId: text("user_id").notNull(),
  overallCompliant: boolean("overall_compliant").notNull(),
  rulesEvaluated: integer("rules_evaluated").default(0),
  rulesPassed: integer("rules_passed").default(0),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

export const tradeRuleEvaluations = pgTable("trade_rule_evaluations", {
  id: serial("id").primaryKey(),
  complianceResultId: integer("compliance_result_id").notNull(),
  ruleId: integer("rule_id").notNull(),
  ruleType: text("rule_type").notNull(),
  ruleLabel: text("rule_label").notNull(),
  expectedValue: jsonb("expected_value"),
  actualValue: jsonb("actual_value"),
  passed: boolean("passed").notNull(),
  violationReason: text("violation_reason"),
});

export const insertTradeComplianceResultSchema = createInsertSchema(tradeComplianceResults).omit({ id: true, evaluatedAt: true });
export const insertTradeRuleEvaluationSchema = createInsertSchema(tradeRuleEvaluations).omit({ id: true });

export type TradeComplianceResult = typeof tradeComplianceResults.$inferSelect;
export type InsertTradeComplianceResult = z.infer<typeof insertTradeComplianceResultSchema>;
export type TradeRuleEvaluation = typeof tradeRuleEvaluations.$inferSelect;
export type InsertTradeRuleEvaluation = z.infer<typeof insertTradeRuleEvaluationSchema>;

export const instrumentAnalyses = pgTable("instrument_analyses", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  symbol: text("symbol").notNull(),
  analysisText: text("analysis_text").notNull(),
  tradeCount: integer("trade_count").default(0),
  winRate: text("win_rate"),
  avgProfitLoss: text("avg_profit_loss"),
  totalProfitLoss: text("total_profit_loss"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInstrumentAnalysisSchema = createInsertSchema(instrumentAnalyses).omit({ id: true, createdAt: true });
export type InstrumentAnalysis = typeof instrumentAnalyses.$inferSelect;
export type InsertInstrumentAnalysis = z.infer<typeof insertInstrumentAnalysisSchema>;

export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLessonProgressSchema = createInsertSchema(lessonProgress).omit({ id: true, createdAt: true });
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;

export const lessonBookmarks = pgTable("lesson_bookmarks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLessonBookmarkSchema = createInsertSchema(lessonBookmarks).omit({ id: true, createdAt: true });
export type LessonBookmark = typeof lessonBookmarks.$inferSelect;
export type InsertLessonBookmark = z.infer<typeof insertLessonBookmarkSchema>;

export const quizResults = pgTable("quiz_results", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: jsonb("answers").default({}),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const insertQuizResultSchema = createInsertSchema(quizResults).omit({ id: true, completedAt: true });
export type QuizResult = typeof quizResults.$inferSelect;
export type InsertQuizResult = z.infer<typeof insertQuizResultSchema>;

// ==================== PROP FIRM CHALLENGES ====================
export const propFirmChallenges = pgTable("prop_firm_challenges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  firmName: text("firm_name").notNull(),
  challengeName: text("challenge_name").notNull(),
  phase: text("phase").notNull().default("Phase 1"),
  accountSize: text("account_size").notNull(),
  currency: text("currency").default("USD"),
  profitTarget: text("profit_target").notNull(),
  dailyDrawdownLimit: text("daily_drawdown_limit").notNull(),
  maxDrawdownLimit: text("max_drawdown_limit").notNull(),
  trailingDrawdown: boolean("trailing_drawdown").default(false),
  drawdownType: text("drawdown_type").default("static"),
  trailingStopBehavior: text("trailing_stop_behavior").default("always_trails"),
  phaseLink: boolean("phase_link").default(false),
  minTradingDays: integer("min_trading_days").default(0),
  maxTradingDays: integer("max_trading_days"),
  consistencyRule: boolean("consistency_rule").default(false),
  maxDayProfitPercent: text("max_day_profit_percent"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"),
  currentBalance: text("current_balance"),
  highWaterMark: text("high_water_mark"),
  mt5AccountId: text("mt5_account_id"),
  mt5AutoSync: boolean("mt5_auto_sync").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const propFirmDailyStats = pgTable("prop_firm_daily_stats", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull(),
  userId: text("user_id").notNull(),
  date: timestamp("date").notNull(),
  startingBalance: text("starting_balance").notNull(),
  endingBalance: text("ending_balance").notNull(),
  dayPl: text("day_pl").notNull(),
  tradesCount: integer("trades_count").default(0),
  dailyDrawdownUsed: text("daily_drawdown_used"),
  highWaterMark: text("high_water_mark"),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("cover_image"),
  category: text("category"),
  tags: text("tags").array().default([]),
  status: text("status").default("draft"),
  authorId: text("author_id"),
  authorName: text("author_name"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueSlug: uniqueIndex("blog_posts_unique_slug").on(table.slug),
}));

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true, updatedAt: true });
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;

export const insertPropFirmChallengeSchema = createInsertSchema(propFirmChallenges).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePropFirmChallengeSchema = insertPropFirmChallengeSchema.partial();
export type PropFirmChallenge = typeof propFirmChallenges.$inferSelect;
export type InsertPropFirmChallenge = z.infer<typeof insertPropFirmChallengeSchema>;

export const insertPropFirmDailyStatSchema = createInsertSchema(propFirmDailyStats).omit({ id: true });
export type PropFirmDailyStat = typeof propFirmDailyStats.$inferSelect;
export type InsertPropFirmDailyStat = z.infer<typeof insertPropFirmDailyStatSchema>;

// ==================== MARKETING HUB ====================

export const marketingBrandSettings = pgTable("marketing_brand_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  brandName: text("brand_name").notNull(),
  description: text("description"),
  targetAudiencePersonas: jsonb("target_audience_personas").default([]),
  uniqueSellingPoints: jsonb("unique_selling_points").default([]),
  competitors: jsonb("competitors").default([]),
  brandVoice: text("brand_voice"),
  brandTone: text("brand_tone"),
  colors: jsonb("colors").default([]),
  keyMessages: jsonb("key_messages").default([]),
  contentPipeline: jsonb("content_pipeline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMarketingBrandSettingsSchema = createInsertSchema(marketingBrandSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type MarketingBrandSettings = typeof marketingBrandSettings.$inferSelect;
export type InsertMarketingBrandSettings = z.infer<typeof insertMarketingBrandSettingsSchema>;

export const marketingContent = pgTable("marketing_content", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  platform: text("platform").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  hook: text("hook"),
  cta: text("cta"),
  hashtags: text("hashtags"),
  topicTags: text("topic_tags").array().default([]),
  frameworkUsed: text("framework_used"),
  campaignId: integer("campaign_id"),
  status: text("status").notNull().default("draft"),
  performanceRating: integer("performance_rating"),
  aiModelUsed: text("ai_model_used"),
  scheduledDate: timestamp("scheduled_date"),
  repurposedFrom: integer("repurposed_from"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingContentSchema = createInsertSchema(marketingContent).omit({ id: true, createdAt: true });
export type MarketingContent = typeof marketingContent.$inferSelect;
export type InsertMarketingContent = z.infer<typeof insertMarketingContentSchema>;

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal"),
  description: text("description"),
  type: text("type").notNull(),
  status: text("status").notNull().default("planning"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: text("budget"),
  targetAudience: text("target_audience"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({ id: true, createdAt: true });
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export const marketingAdStrategies = pgTable("marketing_ad_strategies", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  campaignType: text("campaign_type").notNull(),
  objective: text("objective"),
  audienceTargeting: jsonb("audience_targeting").default({}),
  budgetStrategy: jsonb("budget_strategy").default({}),
  bidStrategy: text("bid_strategy"),
  adCopyIds: text("ad_copy_ids").array().default([]),
  optimizationRules: jsonb("optimization_rules").default({}),
  performanceNotes: text("performance_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingAdStrategySchema = createInsertSchema(marketingAdStrategies).omit({ id: true, createdAt: true });
export type MarketingAdStrategy = typeof marketingAdStrategies.$inferSelect;
export type InsertMarketingAdStrategy = z.infer<typeof insertMarketingAdStrategySchema>;

export const marketingEmailSequences = pgTable("marketing_email_sequences", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  name: text("name").notNull(),
  subjectLine: text("subject_line").notNull(),
  body: text("body").notNull(),
  recipientSegment: text("recipient_segment").notNull().default("all_users"),
  status: text("status").notNull().default("draft"),
  sentCount: integer("sent_count").default(0),
  openRate: text("open_rate"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMarketingEmailSequenceSchema = createInsertSchema(marketingEmailSequences).omit({ id: true, createdAt: true });
export type MarketingEmailSequence = typeof marketingEmailSequences.$inferSelect;
export type InsertMarketingEmailSequence = z.infer<typeof insertMarketingEmailSequenceSchema>;

// ==================== AI USAGE & COST TRACKING ====================

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  userTier: text("user_tier").notNull(),
  feature: text("feature").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  costUsd: text("cost_usd").notNull(),
  requestDuration: integer("request_duration"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLogs).omit({ id: true, createdAt: true });
export type AiUsageLog = typeof aiUsageLogs.$inferSelect;
export type InsertAiUsageLog = z.infer<typeof insertAiUsageLogSchema>;

export const manualCosts = pgTable("manual_costs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  amount: text("amount").notNull(),
  frequency: text("frequency").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertManualCostSchema = createInsertSchema(manualCosts).omit({ id: true, createdAt: true });
export type ManualCost = typeof manualCosts.$inferSelect;
export type InsertManualCost = z.infer<typeof insertManualCostSchema>;

export const costBudgetAlerts = pgTable("cost_budget_alerts", {
  id: serial("id").primaryKey(),
  monthlyBudget: text("monthly_budget").notNull(),
  alertThreshold: integer("alert_threshold").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCostBudgetAlertSchema = createInsertSchema(costBudgetAlerts).omit({ id: true, createdAt: true });
export type CostBudgetAlert = typeof costBudgetAlerts.$inferSelect;
export type InsertCostBudgetAlert = z.infer<typeof insertCostBudgetAlertSchema>;

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
  progress: integer("progress").default(0),
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({ id: true, unlockedAt: true });
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

export const userStreaks = pgTable("user_streaks", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  streakType: text("streak_type").notNull(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivityDate: timestamp("last_activity_date"),
  totalXp: integer("total_xp").default(0),
});

export const insertUserStreakSchema = createInsertSchema(userStreaks).omit({ id: true });
export type UserStreak = typeof userStreaks.$inferSelect;
export type InsertUserStreak = z.infer<typeof insertUserStreakSchema>;

// ==================== LEAD MAGNETS ====================

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  source: text("source").notNull(),
  metadata: jsonb("metadata"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

// ==================== EMAIL DRIP SEQUENCES ====================

export const emailSequences = pgTable("email_sequences", {
  id: serial("id").primaryKey(),
  email: text("email"),
  userId: text("user_id"),
  track: text("track").notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  nextSendAt: timestamp("next_send_at").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailSequenceSchema = createInsertSchema(emailSequences).omit({ id: true, createdAt: true });
export type EmailSequence = typeof emailSequences.$inferSelect;
export type InsertEmailSequence = z.infer<typeof insertEmailSequenceSchema>;

// ==================== RISK ALERTS ====================

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // daily_dd_warn, daily_dd_critical, max_dd_warn, max_dd_critical, revenge_trade, overtrading, strategy_deviation
  severity: text("severity").notNull().default("medium"), // low, medium, high
  title: text("title").notNull(),
  body: text("body").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
  linkUrl: text("link_url"),
  channelInApp: boolean("channel_in_app").default(true),
  channelEmail: boolean("channel_email").default(false),
  emailSent: boolean("email_sent").default(false),
  readAt: timestamp("read_at"),
  dedupeKey: text("dedupe_key"),
  cooldownUntil: timestamp("cooldown_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const alertPreferences = pgTable("alert_preferences", {
  userId: text("user_id").primaryKey(),
  // Per-type master toggle (off = neither in-app nor email)
  drawdownEnabled: boolean("drawdown_enabled").default(true),
  // Channel toggles (require master enabled)
  drawdownInApp: boolean("drawdown_in_app").default(true),
  drawdownEmail: boolean("drawdown_email").default(true),
  drawdownWarnThreshold: integer("drawdown_warn_threshold").default(70), // percent of limit
  drawdownCriticalThreshold: integer("drawdown_critical_threshold").default(90),
  revengeEnabled: boolean("revenge_enabled").default(true),
  revengeInApp: boolean("revenge_in_app").default(true),
  revengeEmail: boolean("revenge_email").default(true),
  overtradingEnabled: boolean("overtrading_enabled").default(true),
  overtradingInApp: boolean("overtrading_in_app").default(true),
  overtradingEmail: boolean("overtrading_email").default(false),
  overtradingDailyCap: integer("overtrading_daily_cap").default(10),
  strategyDeviationEnabled: boolean("strategy_deviation_enabled").default(true),
  strategyDeviationInApp: boolean("strategy_deviation_in_app").default(true),
  strategyDeviationEmail: boolean("strategy_deviation_email").default(false),
  cooldownMinutes: integer("cooldown_minutes").default(60),
  // Once-a-day digest email summarizing yesterday's risk alerts.
  // Independent of real-time per-alert emails.
  digestEnabled: boolean("digest_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAlertPreferencesSchema = createInsertSchema(alertPreferences).omit({ updatedAt: true });
export type AlertPreferences = typeof alertPreferences.$inferSelect;
export type InsertAlertPreferences = z.infer<typeof insertAlertPreferencesSchema>;

// ==================== DATABASE BACKUPS ====================

export const databaseBackups = pgTable("database_backups", {
  id: serial("id").primaryKey(),
  runAt: timestamp("run_at").defaultNow().notNull(),
  status: text("status").notNull(), // 'success' | 'failure'
  storageKey: text("storage_key"),
  sizeBytes: integer("size_bytes"),
  durationMs: integer("duration_ms"),
  isMonthly: boolean("is_monthly").default(false).notNull(),
  trigger: text("trigger").default("scheduled").notNull(), // 'scheduled' | 'manual'
  errorMessage: text("error_message"),
  // Restore-verification fields (#41). Populated by verifyLatestBackup().
  restoreVerifiedAt: timestamp("restore_verified_at"),
  restoreVerifiedStatus: text("restore_verified_status"), // 'success' | 'failure' | null
  restoreVerifiedMessage: text("restore_verified_message"),
});

export const insertDatabaseBackupSchema = createInsertSchema(databaseBackups).omit({ id: true, runAt: true });
export type DatabaseBackup = typeof databaseBackups.$inferSelect;
export type InsertDatabaseBackup = z.infer<typeof insertDatabaseBackupSchema>;
