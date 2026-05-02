import { Sparkles, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { dismissSampleMode } from "@/hooks/useSampleMode";

interface Props {
  /** Optional override label for the surface — e.g. "this prop firm challenge". */
  surface?: string;
  /** When true, the banner can be dismissed (writes a localStorage flag). */
  dismissible?: boolean;
}

function trackEvent(name: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", name, params || {});
    }
  } catch {}
}

export function SampleDataBanner({ surface, dismissible = true }: Props) {
  const [hidden, setHidden] = useState(false);

  // Fire the activation analytics event the first time the banner mounts on
  // a given surface — this is the canonical signal that a user is seeing
  // sample data.
  useEffect(() => {
    trackEvent("sample_data_viewed", { surface: surface ?? "dashboard" });
  }, [surface]);

  if (hidden) return null;

  const subject = surface ?? "your dashboard";

  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 sm:px-5 sm:py-3.5"
      data-testid="banner-sample-data"
    >
      <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 sm:flex">
        <Sparkles size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-bold text-foreground">
          You're viewing sample data
        </p>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
          We populated {subject} with a realistic 60-day demo so you can explore the product. Connect your MT5 account to see your real trades.
        </p>
      </div>
      <Link
        to="/mt5-bridge"
        className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-950 hover:bg-emerald-400 transition"
        data-testid="button-sample-banner-connect"
      >
        Connect MT5 <ArrowRight size={14} />
      </Link>
      <Link
        to="/mt5-bridge"
        className="sm:hidden inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-950"
        data-testid="button-sample-banner-connect-mobile"
      >
        Connect <ArrowRight size={12} />
      </Link>
      {dismissible && (
        <button
          type="button"
          onClick={() => {
            dismissSampleMode();
            setHidden(true);
          }}
          className="ml-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground"
          aria-label="Hide sample data"
          data-testid="button-sample-banner-dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SampleDataBanner;
