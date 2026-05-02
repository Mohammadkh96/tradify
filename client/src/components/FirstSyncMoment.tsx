import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const LS_PREFIX = "tradify_first_sync_seen_";

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

  useEffect(() => {
    if (!userId) return;
    const status = mt5?.status ?? null;
    const lsKey = `${LS_PREFIX}${userId}`;
    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(lsKey) === "1";
    } catch {}

    // The localStorage flag is the source of truth: if we've never shown the
    // moment AND the user is currently connected, this is their first time
    // seeing real data — show the celebration.
    if (status === "CONNECTED" && !alreadySeen) {
      setOpen(true);
      try {
        localStorage.setItem(lsKey, "1");
      } catch {}
    }
  }, [mt5?.status, userId]);

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
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
            First insight
          </div>
          <p className="mt-1.5 text-sm text-foreground">
            {positions.length > 0
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
