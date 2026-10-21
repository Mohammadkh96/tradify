export type UserRole = 'TRADER' | 'COACH' | 'MODERATOR' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';

export type CoachApplicationState =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'REVOKED';

export type CoachPresenceState =
  | 'OFFLINE'
  | 'AVAILABLE'
  | 'BUSY'
  | 'IN_SESSION'
  | 'AWAY';

export type VerificationBadge =
  | 'IDENTITY_VERIFIED'
  | 'KNOWLEDGE_VERIFIED'
  | 'EXPERIENCE_VERIFIED'
  | 'PERFORMANCE_VERIFIED'
  | 'PLATFORM_TRUSTED';

export type SessionState =
  | 'REQUESTED'
  | 'MATCHING'
  | 'MATCHED'
  | 'COACH_CLAIMED'
  | 'ACCEPTED'
  | 'PAYMENT_AUTHORIZED'
  | 'ROOM_READY'
  | 'ACTIVE'
  | 'ENDING'
  | 'COMPLETED'
  | 'SETTLED'
  | 'NO_COACH_FOUND'
  | 'COACH_DECLINED'
  | 'TRADER_CANCELLED'
  | 'COACH_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'CONNECTION_FAILED'
  | 'TERMINATED'
  | 'DISPUTED'
  | 'REFUNDED';

export type MatchRequestState =
  | 'CREATED'
  | 'SEARCHING'
  | 'OFFER_SENT'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'FAILED';

export type PaymentState =
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED'
  | 'PAID_OUT';

export type PayoutState =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'HELD';

export type CoachingTopic =
  | 'MARKET_STRUCTURE'
  | 'ENTRY_TIMING'
  | 'RISK_MANAGEMENT'
  | 'TRADE_REVIEW'
  | 'STRATEGY'
  | 'PSYCHOLOGY'
  | 'PLATFORM_HELP'
  | 'GENERAL_COACHING';

export type ExperienceLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';

export type MarketInstrument =
  | 'FOREX'
  | 'CRYPTO'
  | 'INDICES'
  | 'COMMODITIES'
  | 'EQUITIES'
  | 'FUTURES'
  | 'OPTIONS';

export type ComplianceActivityType =
  | 'GENERAL_EDUCATION'
  | 'RISK_EDUCATION'
  | 'HISTORICAL_REVIEW'
  | 'MARKET_STRUCTURE_EDUCATION'
  | 'PERSONALIZED_RECOMMENDATION'
  | 'LIVE_SIGNAL'
  | 'TRADE_EXECUTION'
  | 'COPY_TRADING'
  | 'ACCOUNT_MANAGEMENT';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  countryCode: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TraderProfile {
  id?: string;
  userId: string;
  experienceLevel: ExperienceLevel;
  preferredMarkets: string[];
  instruments: MarketInstrument[];
  tradingStyles: string[];
  methodologies: string[];
  timezone?: string;
  onboardingCurrentStep: number;
  onboardingCompletedAt?: string;
  totalSessionsCompleted: number;
  totalSpentCents: number;
  blockedCoachIds: string[];
  preferredInstruments?: MarketInstrument[];
  preferredLanguages?: string[];
  preferredSessionDurationMinutes?: number;
  maxInstantRateMinor?: number;
  maxInstantRateCurrency?: string;
}

export interface CoachProfile {
  userId: string;
  headline: string;
  bio: string;
  yearsOfExperience: number;
  hourlyRateCents: number; // Stored in integer minor units (USD Cents)
  verificationStatus?: VerificationBadge | string;
  minimumSessionMinutes: number;
  supportedInstruments: MarketInstrument[];
  specialties: CoachingTopic[];
  languages: string[];
  presenceState: CoachPresenceState;
  badges: VerificationBadge[];
  ratingAverage: number;
  ratingCount: number;
  responseRatePercent: number;
  totalCoachingMinutes: number;
  activeSessionId?: string;
}

export interface MatchScoreBreakdown {
  instrumentFit: number; // 25% max
  specialtyFit: number;  // 20% max
  languageFit: number;   // 15% max
  coachQuality: number;  // 15% max
  availability: number;  // 10% max
  priceFit: number;      // 5% max
  responseReliability: number; // 5% max
  historicalCompatibility: number; // 5% max
  totalScore: number;    // 0 - 100
}

export interface MatchCandidate {
  coachId: string;
  coachUser: User;
  coachProfile: CoachProfile;
  scoreBreakdown: MatchScoreBreakdown;
  isEligible: boolean;
  ineligibilityReasons: string[];
  hourlyRateCents: number;
  offeredAt?: string;
}

export interface MatchRequest {
  id: string;
  traderId: string;
  traderUser?: User;
  instrument: MarketInstrument;
  symbol?: string;
  topic: CoachingTopic;
  experienceLevel: ExperienceLevel;
  language: string;
  maxHourlyRateCents: number;
  specificNotes?: string;
  state: MatchRequestState;
  candidateIds: string[];
  matchedCoachId?: string;
  sessionId?: string;
  createdAt: string;
  expiresAt: string;
}

export interface SessionParticipant {
  userId: string;
  role: 'TRADER' | 'COACH' | 'OBSERVER';
  joinedAt?: string;
  leftAt?: string;
  connectionState: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  hasVideo: boolean;
  hasAudio: boolean;
  isScreenSharing: boolean;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  eventType:
    | 'session.created'
    | 'session.matched'
    | 'session.joined'
    | 'session.started'
    | 'session.paused'
    | 'session.resumed'
    | 'session.disconnected'
    | 'session.reconnected'
    | 'session.ended'
    | 'session.settled';
  actorId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  messageType: 'CHAT' | 'SYSTEM' | 'NOTE' | 'TRADE_REVIEW' | 'FILE';
  attachmentUrl?: string;
  attachmentName?: string;
  timestamp: string;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartDrawing {
  id: string;
  type: 'LINE' | 'RECTANGLE' | 'FIBONACCI' | 'TEXT' | 'ARROW';
  points: { time: number; price: number }[];
  color: string;
  label?: string;
  createdBy: string;
}

export interface SharedChartState {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1D';
  viewport: {
    fromTime: number;
    toTime: number;
    minPrice: number;
    maxPrice: number;
  };
  followMode: 'NONE' | 'COACH' | 'TRADER';
  coachPointer?: {
    active: boolean;
    time: number;
    price: number;
    label: string;
  };
  drawings: ChartDrawing[];
  lastUpdatedBy: string;
  timestamp: string;
}

export interface Session {
  id: string;
  matchRequestId: string;
  traderId: string;
  coachId: string;
  traderUser?: User;
  coachUser?: User;
  coachProfile?: CoachProfile;
  instrument: MarketInstrument;
  symbol: string;
  topic: CoachingTopic;
  state: SessionState;
  hourlyRateCents: number; // Stored in integer minor units
  authorizedMaxCents: number;
  settledAmountCents: number;
  coachEarningsCents: number;
  platformFeeCents: number;
  paymentId?: string;
  roomToken?: string;
  roomUrl?: string;
  videoRoomSession?: {
    roomName: string;
    token: string;
    serverUrl: string;
    participantIdentity?: string;
    participantName?: string;
    providerStatus?: 'CONFIGURED' | 'NOT_CONFIGURED';
  };
  startedAt?: string;

  endedAt?: string;
  durationSeconds: number;
  events: SessionEvent[];
  participants: SessionParticipant[];
  chartState: SharedChartState;
  notes: string;
  homework?: string;
  actionItems: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  sessionId?: string;
  paymentId?: string;
  payoutId?: string;
  accountType: 'TRADER_HOLD' | 'PLATFORM_REVENUE' | 'COACH_PAYABLE' | 'REFUND_RESERVE';
  amountCents: number;
  currency: 'USD';
  direction: 'DEBIT' | 'CREDIT';
  description: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

export interface JurisdictionPolicy {
  countryCode: string;
  regionName: string;
  allowedActivities: ComplianceActivityType[];
  prohibitedActivities: ComplianceActivityType[];
  requiresLicenseDisclosure: boolean;
  maxSessionHoursDaily: number;
  mandatoryEducationalDisclaimer: string;
}

export interface Review {
  id: string;
  sessionId: string;
  traderId: string;
  coachId: string;
  rating: number; // 1 - 5
  feedback: string;
  topicsReviewed: CoachingTopic[];
  wouldRecommend: boolean;
  createdAt: string;
}
