import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  actOnUserTrade,
  createUserAlert,
  deleteUserAlert,
  getCurrentUser,
  getMembershipStatus,
  getMarketSnapshot,
  getMarketsCatalog,
  getUserNotifications,
  getUserAlerts,
  getUserTrades,
  getWatchlist,
  markAllNotificationsRead as markAllNotificationsReadRequest,
  markNotificationRead as markNotificationReadRequest,
  logout as logoutRequest,
  patchUserProfile,
  createUserTrade,
  deleteUserAccount,
  getMarketQuotes,
  reconcileRevenueCatTransfers,
  addWatchlistSymbol,
  removeWatchlistSymbol,
  setWatchlistAlert,
  register as registerRequest,
  acknowledgeRiskDisclaimer as acknowledgeRiskDisclaimerRequest,
  signIn as signInRequest,
  syncMembership,
  type Notification as ApiNotification,
  type MarketCatalogItem as ApiMarketCatalogItem,
  type CustomerAccessPolicy,
  type RevenueCatTransferRecoveryOutcome,
} from "@workspace/api-client-react";
import { mergeLiveQuotes, startLiveQuotePolling, type LiveQuoteResponse } from "./live-quotes";
import {
  DEFAULT_ACCESS_POLICY,
  hasMembershipFeature,
  membershipMeetsTier,
  type MembershipTier,
  type PaidMembershipTier,
} from "@/constants/membership";
import { RISK_DISCLAIMER_VERSION } from "@/constants/risk-disclaimer";
import { revokeNativePushToken } from "./native-push";

export type StrategyName =
  | "Gold setup"
  | "FX setup"
  | "BBB setup"
  | "BBB Gold 3S"
  | "DGv8"
  | "DGv8 FX"
  | "BBB"
  | "Monitoring";
export type Market = "FOREX" | "METALS" | "INDICES" | "CRYPTO" | "COMMODITIES" | "STOCKS" | "OTHER";

export interface Signal {
  id: string;
  symbol: string;
  name: string;
  market: Market;
  direction: "LONG" | "SHORT" | "NONE";
  strategy: StrategyName;
  setupLabel?: StrategyName;
  grade: "A+" | "A" | "B";
  action: string;
  strategyVersion?: string;
  lifecycleStatus?: string;
  qualified?: boolean;
  price: number;
  entry: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  session: string;
  age: string;
  note: string;
  dataState?: "LIVE" | "FALLBACK" | "STALE" | "ERROR";
  referenceState?: "REFERENCE" | "STALE" | "UNAVAILABLE";
  referenceCondition?: "ACTIVE_SOURCE" | "MARKET_CLOSED" | "STALE_SOURCE" | "UNAVAILABLE";
  sourceAgeSeconds?: number;
  provider?: string;
  providerSymbol?: string;
  buyGate?: number | null;
  sellGate?: number | null;
  targets?: number[];
  reasons?: string[];
  provenance?: Record<string, unknown>;
  strategyFacts?: Record<string, unknown>;
  dgv8ChartLevels?: Record<string, unknown>;
  dgv8LevelMap?: Record<string, unknown>;
  levels?: Record<string, unknown>;
}

export interface WatchItem {
  symbol: string;
  name: string;
  market: Market;
  price: number;
  change: number;
  open: boolean;
  alerts: boolean;
  dataState?: "LIVE" | "FALLBACK" | "STALE" | "ERROR";
  referenceState?: "REFERENCE" | "STALE" | "UNAVAILABLE";
  referenceCondition?: "ACTIVE_SOURCE" | "MARKET_CLOSED" | "STALE_SOURCE" | "UNAVAILABLE";
  sourceAgeSeconds?: number;
  setupLabel?: StrategyName | null;
  changeBasis?: "STREAM" | "PREVIOUS_CLOSE" | "24H";
  provider?: string;
  brokerSymbol?: string;
  requiredTier?: "Free" | "Pro" | "VIP";
  accessible?: boolean;
  strategySupported?: boolean;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entry?: number;
  stop?: number;
  target?: number;
  progress?: number;
  r?: number;
  status: "ACTIVE" | "TP1 HIT" | "CLOSED";
  locked?: boolean;
  createdAt?: string;
  closedAt?: string;
}

export type DetailedTrade = Trade & {
  entry: number;
  stop: number;
  target: number;
  progress: number;
  r: number;
};

type ApiTradeRecord = {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  status: Trade["status"];
  locked?: boolean;
  entry?: number;
  stop?: number;
  target?: number;
  progress?: number;
  r?: number;
  createdAt?: string;
  closedAt?: string;
};

const freeStarterSymbols = new Set(
  Object.entries(DEFAULT_ACCESS_POLICY.marketTiers)
    .filter(([, tier]) => tier === "Free")
    .map(([symbol]) => symbol),
);

export function hasTradeDetails(trade: Trade): trade is DetailedTrade {
  return (
    trade.locked !== true &&
    Number.isFinite(trade.entry) &&
    Number.isFinite(trade.stop) &&
    Number.isFinite(trade.target) &&
    Number.isFinite(trade.progress) &&
    Number.isFinite(trade.r)
  );
}

function normalizeRemoteTrade(record: ApiTradeRecord): Trade {
  if (
    record.locked === true ||
    !Number.isFinite(record.entry) ||
    !Number.isFinite(record.stop) ||
    !Number.isFinite(record.target) ||
    !Number.isFinite(record.progress) ||
    !Number.isFinite(record.r)
  ) {
    return {
      id: record.id,
      symbol: record.symbol,
      direction: record.direction,
      status: record.status,
      locked: true,
    };
  }
  return {
    id: record.id,
    symbol: record.symbol,
    direction: record.direction,
    status: record.status,
    entry: record.entry,
    stop: record.stop,
    target: record.target,
    progress: record.progress,
    r: record.r,
    locked: false,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    ...(record.closedAt ? { closedAt: record.closedAt } : {}),
  };
}

function lockTradesForMembership(
  trades: Trade[],
  membership: MembershipTier,
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
): Trade[] {
  return trades.map((trade) => {
    const symbol = trade.symbol.trim().toUpperCase();
    const requiredTier =
      accessPolicy.marketTiers[symbol] ?? (freeStarterSymbols.has(symbol) ? "Free" : "VIP");
    if (membershipMeetsTier(membership, requiredTier) || trade.locked) return trade;
    return {
      id: trade.id,
      symbol: trade.symbol,
      direction: trade.direction,
      status: trade.status,
      locked: true,
    };
  });
}

function normalizeRemoteTrades(
  records: ApiTradeRecord[],
  membership: MembershipTier,
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
): Trade[] {
  return lockTradesForMembership(records.map(normalizeRemoteTrade), membership, accessPolicy);
}

function normalizeRemoteTradeForMembership(
  record: ApiTradeRecord,
  membership: MembershipTier,
  accessPolicy: CustomerAccessPolicy = DEFAULT_ACCESS_POLICY,
): Trade {
  return normalizeRemoteTrades([record], membership, accessPolicy)[0];
}

export interface Alert {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW" | "EXACT";
  target: number;
  label: string;
  active: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  accountSize: number;
  riskPercent: number;
  maxDailyLoss: number;
  maxTrades: number;
  aggressive: boolean;
  membership: "Free" | "Pro" | "VIP";
  role: "user" | "admin";
  status: "active" | "suspended";
  riskDisclaimerVersion?: string | null;
  riskDisclaimerAcceptedAt?: string | null;
}

export type Notification = ApiNotification;
export type BillingRecoveryOutcome = RevenueCatTransferRecoveryOutcome;
export type AuthTokenPersistenceState = "saved" | "pending" | "memory-only";
export type RegistrationResult = {
  role: "user" | "admin";
  recovery: BillingRecoveryOutcome;
  profileUpdateFailed?: boolean;
};
const signals: Signal[] = []; /*
  { id: 'xau-01', symbol: 'XAUUSD', name: 'Gold / US Dollar', market: 'METALS', direction: 'LONG', strategy: 'DGv8', grade: 'A+', action: 'WAIT FOR RETEST', price: 4361.84, entry: 4363.72, stop: 4351.33, tp1: 4374.11, tp2: 4384.50, tp3: 4402.72, session: 'LONDON', age: '06m', note: 'Decisive M15 body close above the confirmed pivot resistance. The gate is broker-derived from MT5 candles.' },
  { id: 'us100-01', symbol: 'US100', name: 'Nasdaq 100 Index', market: 'INDICES', direction: 'SHORT', strategy: 'BBB', grade: 'A', action: 'BREAKOUT SELL', price: 19842.2, entry: 19828.4, stop: 19910.8, tp1: 19745.2, tp2: 19680.0, tp3: 19542.6, session: 'NEW YORK', age: '18m', note: 'Asia range rejection with confirmation from the New York opening window.' },
  { id: 'eur-01', symbol: 'EURUSD', name: 'Euro / US Dollar', market: 'FOREX', direction: 'LONG', strategy: 'DGv8', grade: 'B', action: 'FORMING', price: 1.08462, entry: 1.08510, stop: 1.08280, tp1: 1.08740, tp2: 1.08920, tp3: 1.09210, session: 'LONDON', age: '31m', note: 'Setup is forming inside the signal window. No trigger yet.' },
]; */

const watchlist: WatchItem[] = (
  [
    {
      symbol: "XAUUSD",
      name: "Gold",
      market: "METALS",
      price: 0,
      change: 0,
      open: true,
      alerts: true,
      dataState: "ERROR",
    },
    {
      symbol: "XAGUSD",
      name: "Silver",
      market: "METALS",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "US100",
      name: "Nasdaq 100",
      market: "INDICES",
      price: 0,
      change: 0,
      open: true,
      alerts: true,
      dataState: "ERROR",
    },
    {
      symbol: "US30",
      name: "Dow Jones",
      market: "INDICES",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "US500",
      name: "S&P 500",
      market: "INDICES",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "EURUSD",
      name: "Euro / Dollar",
      market: "FOREX",
      price: 0,
      change: 0,
      open: true,
      alerts: true,
      dataState: "ERROR",
    },
    {
      symbol: "GBPUSD",
      name: "Pound / Dollar",
      market: "FOREX",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "USDJPY",
      name: "Dollar / Yen",
      market: "FOREX",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "AUDUSD",
      name: "Aussie / Dollar",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "USDCAD",
      name: "Dollar / CAD",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "USDCHF",
      name: "Dollar / Franc",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "NZDUSD",
      name: "Kiwi / Dollar",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "EURGBP",
      name: "Euro / Pound",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "EURJPY",
      name: "Euro / Yen",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "GBPJPY",
      name: "Pound / Yen",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "AUDJPY",
      name: "Aussie / Yen",
      market: "FOREX",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "BTCUSD",
      name: "Bitcoin / Dollar",
      market: "CRYPTO",
      price: 0,
      change: 0,
      open: true,
      alerts: true,
      dataState: "ERROR",
    },
    {
      symbol: "ETHUSD",
      name: "Ether / Dollar",
      market: "CRYPTO",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "GER40",
      name: "DAX Index",
      market: "INDICES",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "UK100",
      name: "FTSE 100",
      market: "INDICES",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "JP225",
      name: "Nikkei 225",
      market: "INDICES",
      price: 0,
      change: 0,
      open: false,
      alerts: false,
      dataState: "ERROR",
    },
    {
      symbol: "USOIL",
      name: "WTI Oil",
      market: "COMMODITIES",
      price: 0,
      change: 0,
      open: true,
      alerts: false,
      dataState: "ERROR",
    },
  ] satisfies WatchItem[]
).map((item) => ({
  ...item,
  open: item.symbol === "USOIL" || item.symbol === "BTCUSD" || item.symbol === "ETHUSD",
  alerts: false,
  requiredTier:
    item.symbol === "USOIL" || item.symbol === "BTCUSD" || item.symbol === "ETHUSD"
      ? "Free"
      : "Pro",
  accessible: item.symbol === "USOIL" || item.symbol === "BTCUSD" || item.symbol === "ETHUSD",
  strategySupported: true,
}));

const initialTrades: Trade[] = [];

const initialProfile: Profile = {
  id: "preview",
  name: "Trader",
  email: "preview@tradify.app",
  accountSize: 10000,
  riskPercent: 0.5,
  maxDailyLoss: 2,
  maxTrades: 3,
  aggressive: false,
  membership: "Free",
  role: "user",
  status: "active",
};
const AUTH_REQUEST_TIMEOUT_MS = 6000;

const initialNotifications: Notification[] = [];
interface Store {
  hydrated: boolean;
  authSessionChecked: boolean;
  authenticated: boolean;
  authTokenPersistenceState: AuthTokenPersistenceState;
  signals: Signal[];
  watchlist: WatchItem[];
  trades: Trade[];
  alerts: Alert[];
  notifications: Notification[];
  notificationSyncState: NotificationSyncState;
  profile: Profile;
  accessPolicy: CustomerAccessPolicy;
  selectedStrategy: StrategyName;
  selectedStrategiesBySymbol: Record<string, StrategyName>;
  mt5Connected: boolean;
  onboardingComplete: boolean;
  toggleWatch: (symbol: string) => void;
  toggleAlert: (symbol: string) => void;
  addAlert: (alert: Omit<Alert, "id">) => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
  addTrade: (signal: Signal) => void;
  closeTrade: (id: string) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  setStrategy: (strategy: StrategyName) => void;
  setStrategyForSymbol: (symbol: string, strategy: StrategyName) => void;
  refreshMarket: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  setMt5Connected: (value: boolean) => void;
  completeOnboarding: (value?: boolean) => void;
  signIn: (email: string, password: string) => Promise<"user" | "admin">;
  register: (email: string, password: string, displayName?: string) => Promise<RegistrationResult>;
  acknowledgeRiskDisclaimer: () => Promise<void>;
  retryAuthTokenPersistence: () => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  billingStatus: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "INACTIVE" | "UNAVAILABLE";
  billingExpiresAt: string | null;
  billingRecovery: BillingRecoveryOutcome | null;
  retryBillingRecovery: () => Promise<BillingRecoveryOutcome>;
  syncMembershipStatus: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);
const storageKey = "tradify-signals-local-v1";
const authTokenKey = "tradify-signals-auth-token-v1";
const authSessionStateKey = "tradify-signals-auth-session-state-v1";
const signedOutAuthSessionState = "signed-out";
const signedInAuthSessionState = "signed-in";
let inMemoryAuthToken: string | null | undefined;
let inMemoryAuthSessionState:
  typeof signedOutAuthSessionState | typeof signedInAuthSessionState | undefined;
let authSessionRevision = 0;
let pendingAuthToken: { token: string; revision: number } | null = null;
let authTokenStorageQueue: Promise<void> = Promise.resolve();
let authTokenWriteInFlight: {
  pending: { token: string; revision: number };
  promise: Promise<boolean>;
} | null = null;
let authTokenPersistenceStatus: AuthTokenPersistenceState = "saved";
const authTokenPersistenceListeners = new Set<(state: AuthTokenPersistenceState) => void>();
const validStrategies = new Set<StrategyName>([
  "Gold setup",
  "FX setup",
  "BBB setup",
  "BBB Gold 3S",
  "DGv8",
  "DGv8 FX",
  "BBB",
  "Monitoring",
]);

function updateAuthTokenPersistenceStatus(status: AuthTokenPersistenceState): void {
  authTokenPersistenceStatus = status;
  for (const listener of authTokenPersistenceListeners) listener(status);
}

function subscribeToAuthTokenPersistence(
  listener: (state: AuthTokenPersistenceState) => void,
): () => void {
  authTokenPersistenceListeners.add(listener);
  listener(authTokenPersistenceStatus);
  return () => authTokenPersistenceListeners.delete(listener);
}

function enqueueAuthTokenStorageOperation(operation: () => Promise<void>): Promise<void> {
  const result = authTokenStorageQueue.then(operation, operation);
  authTokenStorageQueue = result.catch(() => undefined);
  return result;
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (inMemoryAuthSessionState === signedOutAuthSessionState) return null;
  if (inMemoryAuthToken !== undefined) return inMemoryAuthToken;
  try {
    if ((await AsyncStorage.getItem(authSessionStateKey)) === signedOutAuthSessionState) {
      inMemoryAuthSessionState = signedOutAuthSessionState;
      return null;
    }
    const secureToken = await SecureStore.getItemAsync(authTokenKey);
    if (secureToken) return secureToken;

    // Move tokens saved by older app versions into the OS keychain/keystore.
    // Do not return the legacy copy unless secure persistence succeeded.
    const legacyToken = await AsyncStorage.getItem(authTokenKey);
    if (!legacyToken) return null;
    await SecureStore.setItemAsync(authTokenKey, legacyToken);
    await AsyncStorage.removeItem(authTokenKey);
    return legacyToken;
  } catch {
    // If session state cannot be checked, fail closed rather than revive a token.
    return null;
  }
}

export function retryPendingAuthTokenPersistence(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(true);
  const pending = pendingAuthToken;
  if (!pending) return Promise.resolve(true);
  if (authTokenWriteInFlight?.pending === pending) return authTokenWriteInFlight.promise;

  const promise = enqueueAuthTokenStorageOperation(async () => {
    if (
      pendingAuthToken !== pending ||
      authSessionRevision !== pending.revision ||
      inMemoryAuthToken !== pending.token
    )
      return;

    await SecureStore.setItemAsync(authTokenKey, pending.token);
    await AsyncStorage.removeItem(authTokenKey);
    if (
      pendingAuthToken === pending &&
      authSessionRevision === pending.revision &&
      inMemoryAuthToken === pending.token
    ) {
      try {
        await AsyncStorage.setItem(authSessionStateKey, signedInAuthSessionState);
      } catch {
        try {
          await AsyncStorage.removeItem(authSessionStateKey);
        } catch {
          // A persisted signed-out marker remains fail-closed on the next launch.
        }
      }
      inMemoryAuthSessionState = signedInAuthSessionState;
      pendingAuthToken = null;
      updateAuthTokenPersistenceStatus("saved");
    }
  }).then(
    () => true,
    () => false,
  );

  const inFlight = { pending, promise };
  authTokenWriteInFlight = inFlight;
  void promise.finally(() => {
    if (authTokenWriteInFlight === inFlight) authTokenWriteInFlight = null;
  });
  return promise;
}

async function persistAuthToken(token: string): Promise<void> {
  inMemoryAuthToken = token;
  inMemoryAuthSessionState = signedInAuthSessionState;
  if (Platform.OS === "web") {
    pendingAuthToken = null;
    updateAuthTokenPersistenceStatus("memory-only");
    return;
  }
  pendingAuthToken = { token, revision: authSessionRevision };
  updateAuthTokenPersistenceStatus("pending");
  // A storage failure must not turn a successful API sign-in into a failure.
  await retryPendingAuthTokenPersistence();
}

async function persistSignedOutAuthSessionState(): Promise<void> {
  try {
    await enqueueAuthTokenStorageOperation(() =>
      AsyncStorage.setItem(authSessionStateKey, signedOutAuthSessionState),
    );
  } catch {
    // Token removal is still attempted; the in-memory session remains signed out.
  }
}

async function removeAuthToken(): Promise<void> {
  inMemoryAuthToken = null;
  inMemoryAuthSessionState = signedOutAuthSessionState;
  pendingAuthToken = null;
  updateAuthTokenPersistenceStatus("saved");
  try {
    await enqueueAuthTokenStorageOperation(() => AsyncStorage.removeItem(authTokenKey));
  } catch {
    // Keep the in-memory session signed out if device storage is unavailable.
  }
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync(authTokenKey).catch(() => undefined);
  }
}

function isStrategyName(value: unknown): value is StrategyName {
  return typeof value === "string" && validStrategies.has(value as StrategyName);
}

type RemoteSnapshot = Awaited<ReturnType<typeof getMarketSnapshot>>;

function applyRemoteUser(
  setProfile: React.Dispatch<React.SetStateAction<Profile>>,
  user: {
    id: string;
    name: string;
    email: string;
    accountSize: number;
    riskPercent: number;
    maxDailyLoss: number;
    maxTrades: number;
    aggressive: boolean;
    membership: "Free" | "Pro" | "VIP";
    role?: "user" | "admin";
    status?: "active" | "suspended" | "deleted";
    riskDisclaimerVersion?: string | null;
    riskDisclaimerAcceptedAt?: string | null;
  },
) {
  setProfile({
    id: user.id,
    name: user.name,
    email: user.email,
    accountSize: user.accountSize,
    riskPercent: user.riskPercent,
    maxDailyLoss: user.maxDailyLoss,
    maxTrades: user.maxTrades,
    aggressive: user.aggressive,
    membership: user.membership,
    role: user.role ?? "user",
    status: user.status === "suspended" ? "suspended" : "active",
    riskDisclaimerVersion: user.riskDisclaimerVersion ?? null,
    riskDisclaimerAcceptedAt: user.riskDisclaimerAcceptedAt ?? null,
  });
}

export function TradifyProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [authSessionChecked, setAuthSessionChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authTokenPersistenceState, setAuthTokenPersistenceState] =
    useState<AuthTokenPersistenceState>(authTokenPersistenceStatus);
  const [liveSignals, setLiveSignals] = useState<Signal[]>([]);
  const [watch, setWatch] = useState<WatchItem[]>(watchlist);
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [notificationSyncState, setNotificationSyncState] =
    useState<NotificationSyncState>("local");
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [accessPolicy, setAccessPolicy] = useState<CustomerAccessPolicy>(DEFAULT_ACCESS_POLICY);
  const [billingStatus, setBillingStatus] = useState<Store["billingStatus"]>("INACTIVE");
  const [billingExpiresAt, setBillingExpiresAt] = useState<string | null>(null);
  const [billingRecovery, setBillingRecovery] = useState<BillingRecoveryOutcome | null>(null);
  const [selectedStrategy, setStrategy] = useState<StrategyName>("DGv8");
  const [selectedStrategiesBySymbol, setSelectedStrategiesBySymbol] = useState<
    Record<string, StrategyName>
  >({});
  const [mt5Connected, setMt5Connected] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const setStrategyForSymbol = React.useCallback((symbol: string, strategy: StrategyName) => {
    const key = symbol.trim().toUpperCase();
    if (!key) return;
    setSelectedStrategiesBySymbol((current) => ({ ...current, [key]: strategy }));
  }, []);

  useEffect(() => subscribeToAuthTokenPersistence(setAuthTokenPersistenceState), []);

  useEffect(() => {
    let active = true;
    const hydrationRevision = authSessionRevision;
    (async () => {
      try {
        let raw: string | null = null;
        try {
          raw = await AsyncStorage.getItem(storageKey);
        } catch {
          // Keep local defaults and continue startup when preferences are unavailable.
        }
        if (raw) {
          try {
            const saved = JSON.parse(raw) as Partial<Store>;
            if (isStrategyName(saved.selectedStrategy)) setStrategy(saved.selectedStrategy);
            if (
              saved.selectedStrategiesBySymbol &&
              typeof saved.selectedStrategiesBySymbol === "object" &&
              !Array.isArray(saved.selectedStrategiesBySymbol)
            ) {
              const entries: Record<string, StrategyName> = {};
              for (const [symbol, strategy] of Object.entries(saved.selectedStrategiesBySymbol)) {
                const normalizedSymbol = symbol.trim().toUpperCase();
                if (normalizedSymbol && isStrategyName(strategy)) {
                  entries[normalizedSymbol] = strategy;
                }
              }
              setSelectedStrategiesBySymbol(entries);
            }
            if (typeof saved.onboardingComplete === "boolean")
              setOnboardingComplete(saved.onboardingComplete);
          } catch {
            // Keep the resilient local defaults when storage is corrupted.
          }
        }

        // Render the local shell immediately. The remote market snapshot can
        // include fallback-provider calls and should update the shell rather
        // than blocking the preview on a multi-second request.
        if (active) setHydrated(true);

        if (!active || hydrationRevision !== authSessionRevision) return;
        const token = Platform.OS === "web" ? null : await getAuthToken();
        if (!active || hydrationRevision !== authSessionRevision) return;
        if (Platform.OS === "web" || token) {
          if (active) setNotificationSyncState("loading");
          try {
            const response = await getCurrentUser();
            if (!active || hydrationRevision !== authSessionRevision) return;
            const [remoteAlerts, remoteTrades, remoteWatchlist] = await Promise.all([
              getUserAlerts(),
              getUserTrades(),
              getWatchlist(),
            ]);
            if (active && hydrationRevision === authSessionRevision) {
              applyRemoteUser(setProfile, response.user);
              setAuthenticated(true);
              setAlerts(remoteAlerts);
              setTrades(
                normalizeRemoteTrades(remoteTrades, response.user.membership, accessPolicy),
              );
              const alertSymbols = new Set(response.user.alertSymbols);
              setWatch((items) =>
                items.map((item) => ({
                  ...item,
                  open: remoteWatchlist.includes(item.symbol),
                  alerts: alertSymbols.has(item.symbol),
                })),
              );
            }
          } catch {
            if (hydrationRevision === authSessionRevision) await removeAuthToken();
            if (active && hydrationRevision === authSessionRevision) {
              setAuthenticated(false);
              setNotifications(initialNotifications);
              setNotificationSyncState("local");
            }
          }
        } else if (active) {
          setNotificationSyncState("local");
        }
        if (active && hydrationRevision === authSessionRevision) setAuthSessionChecked(true);
        void getMarketSnapshot()
          .then((snapshot) => {
            if (active && hydrationRevision === authSessionRevision) applySnapshot(snapshot);
          })
          .catch(() => undefined);
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const applySnapshot = (snapshot: RemoteSnapshot) => {
    const setupLabels = new Map(
      snapshot.marketSetups.map((item) => [item.symbol, item.setupLabel]),
    );
    const remoteSignals = snapshot.signals
      .filter((item) => {
        const value = item as unknown as Record<string, unknown>;
        return (
          typeof value.id === "string" &&
          typeof value.symbol === "string" &&
          typeof value.price === "number"
        );
      })
      .map((item) => {
        const signal = item as unknown as Signal;
        const setupLabel = isStrategyName(signal.setupLabel)
          ? signal.setupLabel
          : (setupLabels.get(signal.symbol) ?? undefined);
        return {
          ...signal,
          ...(setupLabel ? { setupLabel } : {}),
          strategy: setupLabel ?? "Monitoring",
        } as Signal;
      });
    setLiveSignals(remoteSignals);
    setWatch((items) =>
      items.map((item) => ({
        ...item,
        setupLabel: setupLabels.has(item.symbol)
          ? (setupLabels.get(item.symbol) ?? null)
          : undefined,
      })),
    );
    const remoteQuotes = snapshot.quotes as Record<
      string,
      {
        price?: number;
        changePercent?: number;
        changeBasis?: WatchItem["changeBasis"];
        dataState?: WatchItem["dataState"];
        referenceState?: WatchItem["referenceState"];
        referenceCondition?: WatchItem["referenceCondition"];
        sourceAgeSeconds?: number;
      }
    >;
    setWatch((items) =>
      items.map((item) => {
        const quote = remoteQuotes[item.symbol];
        if (!quote) return item;
        return {
          ...item,
          ...(typeof quote.price === "number" && quote.price > 0 ? { price: quote.price } : {}),
          ...(typeof quote.changePercent === "number" ? { change: quote.changePercent } : {}),
          ...(quote.changeBasis ? { changeBasis: quote.changeBasis } : {}),
          dataState: quote.dataState,
          referenceState: quote.referenceState,
          referenceCondition: quote.referenceCondition,
          sourceAgeSeconds: quote.sourceAgeSeconds,
        };
      }),
    );
    setMt5Connected(Boolean(snapshot.bridge.connected));
  };

  const applyLiveQuotes = (response: LiveQuoteResponse) => {
    setWatch((items) => mergeLiveQuotes(items, [], response).watchlist);
    setLiveSignals((items) => mergeLiveQuotes([], items, response).signals);
    setMt5Connected(mergeLiveQuotes([], [], response).connected);
  };

  const markLiveQuotesRateLimited = () => {
    setWatch(
      (items) => mergeLiveQuotes(items, [], { bridge: { connected: false }, quotes: {} }).watchlist,
    );
    setMt5Connected(false);
  };

  const applyMarketCatalog = React.useCallback((catalog: ApiMarketCatalogItem[]) => {
    setWatch((current) => {
      const existingBySymbol = new Map(current.map((item) => [item.symbol, item]));
      const knownSymbols = new Set(catalog.map((item) => item.symbol));
      const catalogItems: WatchItem[] = catalog.map((item) => {
        const existing = existingBySymbol.get(item.symbol);
        const accessible = item.accessible;
        return {
          symbol: item.symbol,
          name: item.name,
          market: item.assetClass,
          price: accessible
            ? item.currentPrice > 0
              ? item.currentPrice
              : (existing?.price ?? 0)
            : 0,
          change: accessible ? (existing?.change ?? 0) : 0,
          open: existing?.open ?? false,
          alerts: existing?.alerts ?? false,
          dataState: !accessible
            ? "ERROR"
            : item.quoteState === "LIVE"
              ? "LIVE"
              : item.quoteState === "REFERENCE"
                ? "FALLBACK"
                : "ERROR",
          setupLabel: item.defaultSetupLabel,
          requiredTier: item.requiredTier,
          accessible,
          strategySupported: item.strategySupported,
        };
      });
      const legacyItems = current.filter((item) => !knownSymbols.has(item.symbol));
      return [...catalogItems, ...legacyItems];
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    getMarketsCatalog()
      .then((catalog) => {
        if (active) applyMarketCatalog(catalog);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [hydrated, authenticated, profile.membership, accessPolicy.rowVersion, applyMarketCatalog]);

  const createTradeOnServer = async (signal: Signal, id: string): Promise<Trade> => {
    if (signal.direction === "NONE")
      throw new Error("Cannot create a trade without an evaluated direction");
    const response = await createUserTrade({
      id,
      symbol: signal.symbol,
      direction: signal.direction,
      entry: signal.entry,
      stop: signal.stop,
      target: signal.tp2,
    });
    return normalizeRemoteTradeForMembership(response.trade, profile.membership, accessPolicy);
  };

  const refreshAccountState = async (): Promise<void> => {
    const [remoteAlerts, remoteTrades, remoteWatchlist, remoteUser] = await Promise.all([
      getUserAlerts(),
      getUserTrades(),
      getWatchlist(),
      getCurrentUser(),
    ]);
    setAlerts(remoteAlerts);
    setTrades(normalizeRemoteTrades(remoteTrades, remoteUser.user.membership, accessPolicy));
    setWatch((items) => {
      const alertSymbols = new Set(remoteUser.user.alertSymbols);
      return items.map((item) => ({
        ...item,
        open: remoteWatchlist.includes(item.symbol),
        alerts: alertSymbols.has(item.symbol),
      }));
    });
  };

  const refreshNotifications = async (): Promise<void> => {
    if (!authenticated) {
      setNotificationSyncState("local");
      return;
    }
    setNotificationSyncState((current) => (current === "synced" ? current : "loading"));
    try {
      const remoteNotifications = await getUserNotifications();
      setNotifications(remoteNotifications);
      setNotificationSyncState("synced");
    } catch {
      setNotificationSyncState("offline");
    }
  };

  const markNotificationRead = async (id: string): Promise<void> => {
    const previous = notifications;
    setNotifications((items) =>
      items.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
    if (!authenticated) {
      setNotificationSyncState("local");
      return;
    }
    try {
      const response = await markNotificationReadRequest(id);
      setNotifications((items) =>
        items.map((notification) =>
          notification.id === id ? response.notification : notification,
        ),
      );
      setNotificationSyncState("synced");
    } catch {
      setNotifications(previous);
      setNotificationSyncState("offline");
    }
  };

  const markAllNotificationsRead = async (): Promise<void> => {
    const previous = notifications;
    setNotifications((items) => items.map((notification) => ({ ...notification, isRead: true })));
    if (!authenticated) {
      setNotificationSyncState("local");
      return;
    }
    try {
      await markAllNotificationsReadRequest();
      setNotificationSyncState("synced");
    } catch {
      setNotifications(previous);
      setNotificationSyncState("offline");
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    const timer = setInterval(() => {
      getMarketSnapshot()
        .then(applySnapshot)
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    return startLiveQuotePolling(getMarketQuotes, applyLiveQuotes, 1000, markLiveQuotesRateLimited);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !authenticated) return;
    void refreshNotifications();
    const timer = setInterval(() => {
      void refreshNotifications();
    }, 30000);
    return () => clearInterval(timer);
  }, [hydrated, authenticated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      storageKey,
      JSON.stringify({ selectedStrategy, selectedStrategiesBySymbol, onboardingComplete }),
    ).catch(() => undefined);
  }, [hydrated, selectedStrategy, selectedStrategiesBySymbol, onboardingComplete]);

  const membershipSnapshotRef = React.useRef(profile.membership);
  membershipSnapshotRef.current = profile.membership;

  const refreshMembershipSnapshot = React.useCallback(async () => {
    const requestUserId = profile.id;
    const requestSessionRevision = authSessionRevision;
    const previousMembership = membershipSnapshotRef.current;
    const previousPolicyVersion = accessPolicy.rowVersion;
    const response = await getMembershipStatus();
    if (requestSessionRevision !== authSessionRevision || !authenticated) return;
    setAccessPolicy((current) =>
      current.rowVersion === response.accessPolicy.rowVersion ? current : response.accessPolicy,
    );
    setProfile((item) =>
      item.id === requestUserId && item.membership !== response.membership
        ? { ...item, membership: response.membership }
        : item,
    );
    setBillingStatus(response.billingStatus);
    setBillingExpiresAt(response.expiresAt);
    if (
      response.membership === previousMembership &&
      response.accessPolicy.rowVersion === previousPolicyVersion
    )
      return;
    if (!hasMembershipFeature(response.membership, "signalContext", response.accessPolicy)) {
      setLiveSignals([]);
      setNotifications([]);
      setTrades((items) =>
        lockTradesForMembership(items, response.membership, response.accessPolicy),
      );
      setWatch((items) => items.map((item) => ({ ...item, setupLabel: undefined })));
    }
    if (!hasMembershipFeature(response.membership, "priceAlerts", response.accessPolicy)) {
      setAlerts([]);
      setWatch((items) => items.map((item) => ({ ...item, alerts: false })));
    }
    void Promise.all([
      getUserTrades(),
      getUserAlerts(),
      getCurrentUser(),
      getWatchlist(),
      getMarketSnapshot(),
    ])
      .then(([remoteTrades, remoteAlerts, remoteUser, remoteWatchlist, snapshot]) => {
        if (requestSessionRevision !== authSessionRevision || !authenticated) return;
        setTrades(normalizeRemoteTrades(remoteTrades, response.membership, response.accessPolicy));
        setAlerts(remoteAlerts);
        const alertSymbols = new Set(remoteUser.user.alertSymbols);
        setWatch((items) =>
          items.map((item) => ({
            ...item,
            open: remoteWatchlist.includes(item.symbol),
            alerts: alertSymbols.has(item.symbol),
          })),
        );
        applySnapshot(snapshot);
      })
      .catch(() => undefined);
    void refreshNotifications();
  }, [accessPolicy.rowVersion, authenticated, profile.id]);

  const syncMembershipStatus = React.useCallback(async () => {
    const response = await syncMembership();
    setAccessPolicy((current) =>
      current.rowVersion === response.accessPolicy.rowVersion ? current : response.accessPolicy,
    );
    setProfile((item) => ({ ...item, membership: response.membership }));
    setBillingStatus(response.billingStatus);
    setBillingExpiresAt(response.expiresAt);
    await refreshMembershipSnapshot().catch(() => undefined);
  }, [refreshMembershipSnapshot]);

  useEffect(() => {
    if (!hydrated || !authenticated) return;
    let active = true;
    let inFlight = false;
    const refresh = () => {
      if (!active || inFlight) return;
      inFlight = true;
      void refreshMembershipSnapshot()
        .catch(() => undefined)
        .finally(() => {
          inFlight = false;
        });
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription?.remove?.();
    };
  }, [hydrated, authenticated, refreshMembershipSnapshot]);

  const retryBillingRecovery = React.useCallback(async (): Promise<BillingRecoveryOutcome> => {
    const response = await reconcileRevenueCatTransfers();
    setBillingRecovery(response.recovery);
    if (response.recovery !== "provider-deferred") {
      await syncMembershipStatus();
    }
    return response.recovery;
  }, [syncMembershipStatus]);

  const value = useMemo<Store>(
    () => ({
      hydrated,
      authSessionChecked,
      authenticated,
      authTokenPersistenceState,
      signals: liveSignals,
      watchlist: watch,
      trades,
      alerts,
      notifications,
      notificationSyncState,
      profile,
      accessPolicy,
      billingStatus,
      billingExpiresAt,
      billingRecovery,
      selectedStrategy,
      selectedStrategiesBySymbol,
      mt5Connected,
      onboardingComplete,
      toggleWatch: (symbol) => {
        const item = watch.find((entry) => entry.symbol === symbol);
        const open = !item?.open;
        setWatch((items) =>
          items.map((entry) => (entry.symbol === symbol ? { ...entry, open } : entry)),
        );
        if (authenticated) {
          const request = open ? addWatchlistSymbol({ symbol }) : removeWatchlistSymbol(symbol);
          request.catch(() => refreshAccountState()).catch(() => undefined);
        }
      },
      toggleAlert: (symbol) => {
        if (!hasMembershipFeature(profile.membership, "priceAlerts", accessPolicy)) return;
        setWatch((items) => {
          const item = items.find((entry) => entry.symbol === symbol);
          const active = !item?.alerts;
          if (authenticated) {
            setWatchlistAlert(symbol, { active })
              .catch(() => refreshAccountState())
              .catch(() => undefined);
          }
          return items.map((entry) =>
            entry.symbol === symbol ? { ...entry, alerts: active } : entry,
          );
        });
      },
      addAlert: (alert) => {
        if (!hasMembershipFeature(profile.membership, "priceAlerts", accessPolicy))
          return Promise.resolve();
        const optimistic = { ...alert, id: `${Date.now()}` };
        setAlerts((items) => [...items, optimistic]);
        if (authenticated) {
          return createUserAlert({ ...alert, id: optimistic.id })
            .then((response) =>
              setAlerts((items) =>
                items.map((item) => (item.id === optimistic.id ? response.alert : item)),
              ),
            )
            .catch(async () => {
              try {
                setAlerts(await getUserAlerts());
              } catch {
                setAlerts((items) => items.filter((item) => item.id !== optimistic.id));
              }
              throw new Error("Your alert could not be synced. Review your connection and retry.");
            });
        }
        return Promise.resolve();
      },
      removeAlert: (id) => {
        const previous = alerts;
        setAlerts((items) => items.filter((item) => item.id !== id));
        if (authenticated) {
          return deleteUserAlert(id)
            .then(() => undefined)
            .catch(async () => {
              try {
                setAlerts(await getUserAlerts());
              } catch {
                setAlerts(previous);
              }
              throw new Error("The alert could not be removed from your account. Retry shortly.");
            });
        }
        return Promise.resolve();
      },
      addTrade: (signal) => {
        if (signal.direction === "NONE") return;
        const optimistic = {
          id: `${Date.now()}`,
          symbol: signal.symbol,
          direction: signal.direction,
          entry: signal.entry,
          stop: signal.stop,
          target: signal.tp2,
          progress: 0,
          r: 0,
          status: "ACTIVE" as const,
        };
        setTrades((items) => [...items, optimistic]);
        if (authenticated) {
          createTradeOnServer(signal, optimistic.id)
            .then((trade) =>
              setTrades((items) => items.map((item) => (item.id === optimistic.id ? trade : item))),
            )
            .catch(() =>
              getUserTrades()
                .then((records) =>
                  setTrades(normalizeRemoteTrades(records, profile.membership, accessPolicy)),
                )
                .catch(() => undefined),
            );
        }
      },
      closeTrade: (id) => {
        const closedAt = new Date().toISOString();
        setTrades((items) =>
          items.map((item) => {
            if (item.id !== id) return item;
            if (!hasTradeDetails(item)) return { ...item, status: "CLOSED" };
            return {
              ...item,
              status: "CLOSED",
              progress: 100,
              r: item.r > 0 ? item.r : -0.4,
              closedAt,
            };
          }),
        );
        if (authenticated) {
          actOnUserTrade(id, { action: "CLOSE" })
            .then((response) =>
              setTrades((items) =>
                items.map((item) =>
                  item.id === id
                    ? normalizeRemoteTradeForMembership(
                        response.trade,
                        profile.membership,
                        accessPolicy,
                      )
                    : item,
                ),
              ),
            )
            .catch(() =>
              getUserTrades()
                .then((records) =>
                  setTrades(normalizeRemoteTrades(records, profile.membership, accessPolicy)),
                )
                .catch(() => undefined),
            );
        }
      },
      updateProfile: async (patch) => {
        if (!authenticated) {
          setProfile((item) => ({ ...item, ...patch }));
          return;
        }
        const response = await patchUserProfile(patch);
        applyRemoteUser(setProfile, response.user);
      },
      setStrategy,
      setStrategyForSymbol,
      refreshMarket: async () => {
        try {
          const snapshot = await getMarketSnapshot();
          applySnapshot(snapshot);
        } catch {
          // Keep the most recent market state when a manual refresh cannot complete.
        }
      },
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      setMt5Connected,
      completeOnboarding: (value = true) => setOnboardingComplete(value),
      signIn: async (email, password) => {
        const response = await signInRequest(
          { email, password },
          {
            timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
            ...(Platform.OS === "web" ? { headers: { "X-Tradify-Web-Session": "1" } } : {}),
          },
        );
        authSessionRevision += 1;
        if (Platform.OS !== "web") {
          if (!response.token) throw new Error("The native sign-in response did not include a session token.");
          await persistAuthToken(response.token);
        }
        setAuthSessionChecked(true);
        applyRemoteUser(setProfile, response.user);
        setAuthenticated(true);
        setLiveSignals([]);
        setAlerts([]);
        setTrades([]);
        setNotifications([]);
        setWatch((items) => items.map((item) => ({ ...item, open: false, alerts: false })));
        setNotificationSyncState("loading");
        const sessionRevision = authSessionRevision;
        const alertSymbols = new Set(response.user.alertSymbols);
        void Promise.allSettled([
          getUserAlerts(),
          getUserTrades(),
          getWatchlist(),
          getMarketSnapshot(),
        ]).then(([alertsResult, tradesResult, watchlistResult, snapshotResult]) => {
          if (authSessionRevision !== sessionRevision) return;
          if (alertsResult.status === "fulfilled") {
            setAlerts(alertsResult.value);
            setNotificationSyncState("synced");
          } else {
            setNotificationSyncState("offline");
          }
          if (tradesResult.status === "fulfilled")
            setTrades(
              normalizeRemoteTrades(tradesResult.value, response.user.membership, accessPolicy),
            );
          if (watchlistResult.status === "fulfilled") {
            const remoteWatchlist = new Set(watchlistResult.value);
            setWatch((items) =>
              items.map((item) => ({
                ...item,
                open: remoteWatchlist.has(item.symbol),
                alerts: alertSymbols.has(item.symbol),
              })),
            );
          }
          if (snapshotResult.status === "fulfilled") applySnapshot(snapshotResult.value);
        });
        return response.user.role === "admin" ? "admin" : "user";
      },
      register: async (email, password, displayName) => {
        const response = await registerRequest(
          {
            email,
            password,
            acceptRiskDisclaimer: true,
            riskDisclaimerVersion: RISK_DISCLAIMER_VERSION,
          },
          {
            timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
            ...(Platform.OS === "web" ? { headers: { "X-Tradify-Web-Session": "1" } } : {}),
          },
        );
        authSessionRevision += 1;
        if (Platform.OS !== "web") {
          if (!response.token) throw new Error("The native registration response did not include a session token.");
          await persistAuthToken(response.token);
        }
        setAuthSessionChecked(true);
        applyRemoteUser(setProfile, response.user);
        setAuthenticated(true);
        setBillingRecovery(response.recovery);
        setLiveSignals([]);
        setAlerts([]);
        setTrades([]);
        setNotifications([]);
        setWatch((items) => items.map((item) => ({ ...item, open: false, alerts: false })));
        setNotificationSyncState("loading");
        let profileUpdateFailed = false;
        const cleanDisplayName = displayName?.trim();
        if (cleanDisplayName) {
          try {
            const profileResponse = await patchUserProfile({ name: cleanDisplayName });
            applyRemoteUser(setProfile, profileResponse.user);
          } catch {
            // Registration already created a confirmed session. Report the
            // optional profile-update failure without treating signup as failed.
            profileUpdateFailed = true;
          }
        }
        const sessionRevision = authSessionRevision;
        const alertSymbols = new Set(response.user.alertSymbols);
        void Promise.allSettled([
          getUserAlerts(),
          getUserTrades(),
          getWatchlist(),
          getMarketSnapshot(),
        ]).then(([alertsResult, tradesResult, watchlistResult, snapshotResult]) => {
          if (authSessionRevision !== sessionRevision) return;
          if (alertsResult.status === "fulfilled") {
            setAlerts(alertsResult.value);
            setNotificationSyncState("synced");
          } else {
            setNotificationSyncState("offline");
          }
          if (tradesResult.status === "fulfilled")
            setTrades(
              normalizeRemoteTrades(tradesResult.value, response.user.membership, accessPolicy),
            );
          if (watchlistResult.status === "fulfilled") {
            const remoteWatchlist = new Set(watchlistResult.value);
            setWatch((items) =>
              items.map((item) => ({
                ...item,
                open: remoteWatchlist.has(item.symbol),
                alerts: alertSymbols.has(item.symbol),
              })),
            );
          }
          if (snapshotResult.status === "fulfilled") applySnapshot(snapshotResult.value);
        });
        return {
          role: response.user.role === "admin" ? "admin" : "user",
          recovery: response.recovery,
          profileUpdateFailed,
        };
      },
      acknowledgeRiskDisclaimer: async () => {
        const response = await acknowledgeRiskDisclaimerRequest({
          version: RISK_DISCLAIMER_VERSION,
        });
        applyRemoteUser(setProfile, response.user);
      },
      retryAuthTokenPersistence: retryPendingAuthTokenPersistence,
      signOut: async () => {
        authSessionRevision += 1;
        // Persist the local sign-out intent before the network request so a
        // restart cannot revive a token if the request and token removal fail.
        await persistSignedOutAuthSessionState();
        if (authenticated) {
          await revokeNativePushToken(profile.id).catch(() => undefined);
          await logoutRequest().catch(() => undefined);
        }
        await removeAuthToken();
        setAuthenticated(false);
        setBillingRecovery(null);
        setLiveSignals([]);
        setAlerts([]);
        setTrades([]);
        setWatch(watchlist);
        setNotifications(initialNotifications);
        setNotificationSyncState("local");
      },
      deleteAccount: async () => {
        await revokeNativePushToken(profile.id).catch(() => undefined);
        await deleteUserAccount({ confirmation: "DELETE" });
        authSessionRevision += 1;
        await persistSignedOutAuthSessionState();
        await removeAuthToken();
        setAuthenticated(false);
        setBillingRecovery(null);
        setBillingStatus("INACTIVE");
        setBillingExpiresAt(null);
        setProfile(initialProfile);
        setLiveSignals([]);
        setAlerts([]);
        setTrades([]);
        setWatch(watchlist);
        setNotifications(initialNotifications);
        setNotificationSyncState("local");
      },
      retryBillingRecovery,
      syncMembershipStatus,
    }),
    [
      hydrated,
      authSessionChecked,
      authenticated,
      authTokenPersistenceState,
      liveSignals,
      watch,
      trades,
      alerts,
      notifications,
      notificationSyncState,
      profile,
      accessPolicy,
      billingStatus,
      billingExpiresAt,
      billingRecovery,
      selectedStrategy,
      selectedStrategiesBySymbol,
      setStrategyForSymbol,
      mt5Connected,
      onboardingComplete,
      retryBillingRecovery,
      syncMembershipStatus,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useTradify() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useTradify must be used inside TradifyProvider");
  return value;
}

export type NotificationSyncState = "loading" | "synced" | "offline" | "local";
