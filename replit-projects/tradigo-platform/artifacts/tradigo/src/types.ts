export enum UserRole {
  TRADER = 'TRADER',
  COACH = 'COACH',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum CoachVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  IDENTITY_VERIFIED = 'IDENTITY_VERIFIED',
  CREDENTIALS_VERIFIED = 'CREDENTIALS_VERIFIED',
  FULLY_VERIFIED = 'FULLY_VERIFIED',
}

export enum CoachApplicationState {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export enum CoachPresenceState {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  IN_SESSION = 'IN_SESSION',
  AWAY = 'AWAY',
}

export enum SessionState {
  REQUESTED = 'REQUESTED',
  MATCHING = 'MATCHING',
  MATCHED = 'MATCHED',
  ACCEPTED = 'ACCEPTED',
  COACH_CLAIMED = 'COACH_CLAIMED',
  PAYMENT_AUTHORIZED = 'PAYMENT_AUTHORIZED',
  ROOM_READY = 'ROOM_READY',
  ACTIVE = 'ACTIVE',
  ENDING = 'ENDING',
  COMPLETED = 'COMPLETED',
  SETTLED = 'SETTLED',
  NO_COACH_FOUND = 'NO_COACH_FOUND',
  COACH_DECLINED = 'COACH_DECLINED',
  TRADER_CANCELLED = 'TRADER_CANCELLED',
  COACH_CANCELLED = 'COACH_CANCELLED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TERMINATED = 'TERMINATED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentState {
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  DISPUTED = 'DISPUTED',
  PAID_OUT = 'PAID_OUT',
}

export enum PayoutState {
  PENDING = 'PENDING',
  ELIGIBLE = 'ELIGIBLE',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  HELD = 'HELD',
}

export interface CoachMarketplaceDTO {
  id: string;
  displayName: string;
  avatarUrl?: string;
  headline: string;
  bio: string;
  markets: string[];
  supportedInstruments: string[];
  specialties: string[];
  languages: string[];
  yearsOfExperience: number;
  hourlyRateCents: number;
  instantRatePerMinuteCents: number;
  currency: string;
  verificationStatus: CoachVerificationStatus;
  ratingAverage: number;
  ratingCount: number;
  availability?: 'AVAILABLE' | 'AWAY' | 'OFFLINE';
  approved?: boolean;
  completedSessionCount?: number;
  sessionReliabilityPercent?: number | null;
  averageResponseMinutes?: number | null;
  responseSampleCount?: number;
  reliabilitySampleCount?: number;
  teachingMethod?: string | null;
  coachingBoundaries?: string | null;
  profileChangeStatus?: 'CURRENT' | 'PENDING_REVIEW' | 'CHANGES_DECLINED';
  proof?: {
    approval: TrustProofItem;
    identity: TrustProofItem;
    teachingScope: TrustProofItem;
    serviceRecord: TrustProofItem & { sampleSize?: number };
  };
  isFavorited?: boolean;
}

export interface TrustProofItem {
  status: string;
  label: string;
  source: string;
  scope: string;
  asOf?: string | null;
  sampleSize?: number;
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED_BY_TRADER = 'CANCELLED_BY_TRADER',
  CANCELLED_BY_COACH = 'CANCELLED_BY_COACH',
}

export enum BookingEventType {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_RESCHEDULED = 'BOOKING_RESCHEDULED',
  BOOKING_CANCELLED_BY_TRADER = 'BOOKING_CANCELLED_BY_TRADER',
  BOOKING_CANCELLED_BY_COACH = 'BOOKING_CANCELLED_BY_COACH',
}

export interface ScheduledBooking {
  id: string;
  traderUserId: string;
  coachUserId: string;
  coachProfileId: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  status: BookingStatus;
  scheduledRateMinorPerHour: bigint;
  quotedTotalMinor: bigint;
  currency: string;
  coachTimezoneSnapshot: string;
  traderTimezoneSnapshot: string;
  idempotencyKey?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}

export enum DrawingType {
  TREND_LINE = 'TREND_LINE',
  HORIZONTAL_LINE = 'HORIZONTAL_LINE',
  RECTANGLE = 'RECTANGLE',
  TEXT = 'TEXT',
}

export enum Visibility {
  TRADER_PRIVATE = 'TRADER_PRIVATE',
  COACH_PRIVATE = 'COACH_PRIVATE',
  SHARED = 'SHARED',
}

export enum EntryType {
  DAILY_REFLECTION = 'DAILY_REFLECTION',
  SESSION_REFLECTION = 'SESSION_REFLECTION',
  TRADE_REFLECTION = 'TRADE_REFLECTION',
  STRATEGY_NOTE = 'STRATEGY_NOTE',
  LESSON = 'LESSON',
  GENERAL = 'GENERAL',
}

export interface JournalEntry {
  id: string;
  ownerUserId: string;
  title: string;
  body: string;
  entryType: EntryType;
  sessionId?: string;
  tradeReviewId?: string;
  visibility: Visibility;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt?: string;
  tags: string[];
}

export interface SessionLearningRecap {
  id: string;
  sessionId: string;
  traderUserId: string;
  coachUserId: string;
  summaryTitle?: string;
  traderReflection?: string;
  sharedTakeaway?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
}

export enum NoteType {
  GENERAL = 'GENERAL',
  KEY_LESSON = 'KEY_LESSON',
  MISTAKE = 'MISTAKE',
  SETUP = 'SETUP',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT',
  PSYCHOLOGY = 'PSYCHOLOGY',
  ACTION_ITEM_NOTE = 'ACTION_ITEM_NOTE',
}

export interface SessionLearningNote {
  id: string;
  sessionId: string;
  authorUserId: string;
  visibility: Visibility;
  noteType: NoteType;
  body: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt?: string;
}

export enum HomeworkStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export interface SessionHomework {
  id: string;
  sessionId: string;
  assignedByUserId: string;
  assignedToUserId: string;
  title: string;
  description?: string;
  status: HomeworkStatus;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt?: string;
}

export enum TradeDirection {
  LONG = 'LONG',
  SHORT = 'SHORT',
  NONE = 'NONE',
}

export enum TradeOutcome {
  WIN = 'WIN',
  LOSS = 'LOSS',
  BREAKEVEN = 'BREAKEVEN',
  OPEN = 'OPEN',
  NOT_RECORDED = 'NOT_RECORDED',
}

export interface TradeReview {
  id: string;
  ownerUserId: string;
  sessionId?: string;
  instrument: string;
  direction: TradeDirection;
  timeframe?: string;
  entryPrice?: string;
  exitPrice?: string;
  openedAt?: string;
  closedAt?: string;
  pnlMinor?: string | bigint;
  pnlCurrency?: string;
  tradeOutcome: TradeOutcome;
  setupName?: string;
  thesis?: string;
  whatWentWell?: string;
  whatWentWrong?: string;
  lessonLearned?: string;
  disciplineRating?: number;
  confidenceRating?: number;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  version: number;
  archivedAt?: string;
  tags: string[];
}

export interface TradeReviewFeedback {
  id: string;
  tradeReviewId: string;
  authorCoachUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface LearningProgress {
  coachingSessionsCompleted: number;
  journalEntriesCreated: number;
  tradeReviewsCreated: number;
  homeworkAssigned: number;
  homeworkCompleted: number;
  homeworkCompletionRate: number;
  activeLearningDays: number;
  recentLessonsCount: number;
}

