import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { hasEverHadSampleMode } from "@/hooks/useSampleMode";

const LS_PREFIX = "tradify_first_sync_seen_";

function trackEvent(name: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  } catch {}
}

/**
 * Watches the MT5 connection status and shows a one-time celebratory modal
 * when a user goes from "never connected" to "connected" for the first time.
 * Persists the shown state per user in localStorage.
 *
 * Renders nothing until the moment hits.
 */
export function FirstSyncMoment() {
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  const userId = user?.userId;

  const { data: mt5 } = useQuery<any>({
    queryKey: [`/api/mt5/status/${userId}`],
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  const [open, setOpen] = useState(false);
  // Track the previously observed status so we can detect a true
  // non-CONNECTED → CONNECTED transition rather than firing for every
  // connected user on mount.
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const status = mt5?.status ?? null;
    if (status === null) return; // wait for the status query to resolve

    const prev = prevStatusRef.current;
    // First observation in this session — just record it. We don't fire
    // for users who were already CONNECTED when the component mounted,
    // because that's not a transition.
    if (prev === null) {
      prevStatusRef.current = status;
      return;
    }

    // Update the ref for the next render before any early returns below.
    prevStatusRef.current = status;

    // Only a real offline → connected transition counts.
    if (prev === "CONNECTED" || status !== "CONNECTED") return;

    // Eligibility gate: the user must have actually been in sample mode
    // at some point. This prevents the celebration from firing for users
    // who never went through the activation funnel (e.g. existing users
    // reconnecting after a brief MT5 outage).
    if (!hasEverHadSampleMode(userId)) return;

    const lsKey = `${LS_PREFIX}${userId}`;
    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(lsKey) === "1";
    } catch {}
    if (alreadySeen) return;

    setOpen(true);
    trackEvent("aha_moment_shown", { userId });
    try {
      localStorage.setItem(lsKey, "1");
    } catch {}
  }, [mt5?.status, userId]);

  // When the modal opens, ask the existing OpenAI-backed behavioural pipeline
  // for a real one-line insight using the freshly synced trades. We fall back
  // to a static line if the request hasn't returned yet (or errors).
  const { data: aiInsight } = useQuery<{ flags?: Array<{ title: string; description: string }> }>({
    queryKey: ["/api/behavioral-risks", userId, "all"],
    queryFn: async () => {
      const res = await fetch(`/api/behavioral-risks/${userId}?period=all`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && open,
    staleTime: 30_000,
    retry: false,
  });

  if (!open) return null;

  const balance = mt5?.metrics?.balance;
  const equity = mt5?.metrics?.equity;
  const positions = mt5?.metrics?.positions ?? [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      data-testid="modal-first-sync"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-emerald-500/40 bg-card p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          data-testid="button-close-first-sync"
        >
          <X size={16} />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Sparkles size={22} />
        </div>
        <h2 className="text-xl font-black uppercase tracking-tight italic text-foreground">
          You're live.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your MT5 account is connected and we just received your first sync. From here on, every trade flows in automatically.
        </p>

        {(balance || equity) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {balance && (
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Balance
                </div>
                <div className="mt-1 text-lg font-black text-foreground">
                  ${parseFloat(balance).toLocaleString()}
                </div>
              </div>
            )}
            {equity && (
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Equity
                </div>
                <div className="mt-1 text-lg font-black text-foreground">
                  ${parseFloat(equity).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
            First insight
            {!aiInsight && (
              <Loader2 size={11} className="animate-spin opacity-70" />
            )}
          </div>
          <p className="mt-1.5 text-sm text-foreground" data-testid="text-first-insight">
            {aiInsight?.flags && aiInsight.flags.length > 0
              ? `${aiInsight.flags[0].title}. ${aiInsight.flags[0].description}`
              : positions.length > 0
                ? `You have ${positions.length} open position${positions.length === 1 ? "" : "s"}. As soon as your trade history lands, we'll start surfacing behavioural patterns.`
                : `No open positions right now — perfect time to set up your first strategy and let us track every trade as it closes.`}
          </p>
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-950 hover:bg-emerald-400"
            data-testid="button-first-sync-dashboard"
          >
            Go to dashboard <ArrowRight size={14} />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-border px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-muted"
            data-testid="button-first-sync-close"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default FirstSyncMoment;
