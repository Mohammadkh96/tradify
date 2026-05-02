import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTrades } from "@/hooks/use-trades";

/**
 * Sample mode is active when:
 *   - the user is logged in, AND
 *   - they have no real trades stored, AND
 *   - their MT5 status is not CONNECTED.
 *
 * In that state we render the dashboard, prop firm tracker, etc. with a
 * deterministic sample dataset so the user can experience the product
 * before connecting MT5.
 *
 * The dismissal flag lets a user explicitly opt out (e.g. via a banner
 * "hide sample data" toggle) by writing to localStorage. Dismissal fires
 * a custom DOM event so every consumer of `useSampleMode` re-evaluates
 * immediately without waiting for an unrelated re-render.
 */
const LS_KEY = "tradify_sample_mode_dismissed";
const DISMISS_EVENT = "tradify:sample-mode-changed";
const EVER_ACTIVE_PREFIX = "tradify_sample_mode_ever_active_";

/**
 * Marks (per user) that sample mode was active at some point during the
 * lifetime of this account. FirstSyncMoment uses this as an eligibility
 * gate so the celebration only fires for users who actually came through
 * the sample-mode → connected journey.
 */
export function markSampleModeEverActive(userId: string) {
  if (!userId) return;
  try {
    localStorage.setItem(`${EVER_ACTIVE_PREFIX}${userId}`, "1");
  } catch {}
}

export function hasEverHadSampleMode(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${EVER_ACTIVE_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissSampleMode() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {}
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
    }
  } catch {}
}

/**
 * Re-enable sample mode by clearing the dismissal flag. The custom event
 * makes every consumer of `useSampleMode` re-evaluate immediately so the
 * dashboard refreshes without a full page reload.
 */
export function enableSampleMode() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DISMISS_EVENT));
    }
  } catch {}
}

export function isSampleModeDismissed() {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Public hook for components that need to read & flip the dismissal flag
 * (e.g. a Settings toggle). Returns the current dismissed state plus a
 * setter that writes/removes the localStorage key and notifies all other
 * sample-mode consumers via the same custom event used internally.
 */
export function useSampleModeDismissed(): [boolean, (dismissed: boolean) => void] {
  const dismissed = useDismissedFlag();
  const setDismissed = (next: boolean) => {
    if (next) {
      dismissSampleMode();
    } else {
      enableSampleMode();
    }
  };
  return [dismissed, setDismissed];
}

/**
 * Returns a boolean that flips whenever the sample-mode dismissal flag
 * changes (via `dismissSampleMode()` or another tab via `storage` event).
 * Used internally so consumers re-render immediately on dismissal.
 */
function useDismissedFlag(): boolean {
  const [dismissed, setDismissed] = useState<boolean>(() => isSampleModeDismissed());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setDismissed(isSampleModeDismissed());
    window.addEventListener(DISMISS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(DISMISS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return dismissed;
}

export function useSampleMode(): {
  active: boolean;
  reason: "no-user" | "loading" | "has-trades" | "mt5-connected" | "dismissed" | "active";
} {
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  const userId = user?.userId;

  const { data: mt5, isLoading: mt5Loading, isError: mt5Error } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    enabled: !!userId,
    staleTime: 0,
  });

  const { data: trades, isLoading: tradesLoading, isError: tradesError } = useTrades();
  const dismissed = useDismissedFlag();

  if (userLoading) return { active: false, reason: "loading" };
  if (!userId) return { active: false, reason: "no-user" };
  if (dismissed) return { active: false, reason: "dismissed" };
  // Wait until BOTH the trades query and the mt5 status query have resolved
  // so we never flash sample data over real content while loading.
  if (mt5Loading || tradesLoading) return { active: false, reason: "loading" };
  // If either query errored, don't gamble — assume the user might have data
  // and show the empty/loading state instead of sample data.
  if (mt5Error || tradesError) return { active: false, reason: "loading" };
  if (mt5?.status === "CONNECTED") return { active: false, reason: "mt5-connected" };
  if (Array.isArray(trades) && trades.length > 0) return { active: false, reason: "has-trades" };
  // Persist eligibility flag so FirstSyncMoment can gate on it later.
  markSampleModeEverActive(userId);
  return { active: true, reason: "active" };
}
