import { useQuery } from "@tanstack/react-query";
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
 * The `forceOff` flag lets a user explicitly opt out (e.g. via a banner
 * "hide sample data" toggle) by writing to localStorage.
 */
const LS_KEY = "tradify_sample_mode_dismissed";

export function dismissSampleMode() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {}
}

export function isSampleModeDismissed() {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
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

  if (userLoading) return { active: false, reason: "loading" };
  if (!userId) return { active: false, reason: "no-user" };
  if (isSampleModeDismissed()) return { active: false, reason: "dismissed" };
  // Wait until BOTH the trades query and the mt5 status query have resolved
  // so we never flash sample data over real content while loading.
  if (mt5Loading || tradesLoading) return { active: false, reason: "loading" };
  // If either query errored, don't gamble — assume the user might have data
  // and show the empty/loading state instead of sample data.
  if (mt5Error || tradesError) return { active: false, reason: "loading" };
  if (mt5?.status === "CONNECTED") return { active: false, reason: "mt5-connected" };
  if (Array.isArray(trades) && trades.length > 0) return { active: false, reason: "has-trades" };
  return { active: true, reason: "active" };
}
