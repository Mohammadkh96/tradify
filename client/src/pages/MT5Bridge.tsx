import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { MT5_CONNECTOR_PYTHON } from "@/lib/mt5ConnectorScript";
import {
  Cpu,
  Key,
  Download,
  Play,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  Sparkles,
  Info,
  Monitor,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_META: Array<{ title: string; description: string }> = [
  { title: "Get started", description: "What we're about to do" },
  { title: "Generate token", description: "One-click sync key" },
  { title: "Download connector", description: "Get the .pyw file" },
  { title: "Run the connector", description: "Open it on your machine" },
  { title: "Verify connection", description: "Wait for first sync" },
  { title: "You're live", description: "Real data is flowing" },
];

function trackEvent(name: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  } catch {}
}

function StepperHeader({ current }: { current: Step }) {
  return (
    <div className="mb-8" data-testid="wizard-stepper">
      <ol className="grid grid-cols-6 gap-2">
        {STEP_META.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={i} className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors",
                  done && "bg-emerald-500 border-emerald-500 text-slate-950",
                  active && "border-emerald-500 text-emerald-500 bg-emerald-500/10",
                  !done && !active && "border-border text-muted-foreground"
                )}
                data-testid={`stepper-step-${i}`}
              >
                {done ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <div
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  done ? "bg-emerald-500" : active ? "bg-emerald-500/40" : "bg-border"
                )}
              />
              <div className="hidden md:block text-center">
                <div
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.title}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  hideBack = false,
  rightSlot,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
      {!hideBack ? (
        <Button
          variant="ghost"
          onClick={onBack}
          data-testid="button-wizard-back"
          className="gap-1.5"
        >
          <ChevronLeft size={16} />
          Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {rightSlot}
        {onNext && (
          <Button
            onClick={onNext}
            disabled={nextDisabled}
            data-testid="button-wizard-next"
            className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest gap-1.5"
          >
            {nextLabel}
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Final wizard step. Shows the celebratory state and auto-redirects to the
 * dashboard after a short pause so users land on real data without an extra
 * click. The user can also click "Go to dashboard" immediately.
 */
function DoneStep({
  mt5,
  onGoNow,
}: {
  mt5: any;
  onGoNow: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onGoNow();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, onGoNow]);

  return (
    <div className="text-center" data-testid="wizard-step-done">
      <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-4">
        <Sparkles size={32} />
      </div>
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
        You're live.
      </h2>
      <p className="text-muted-foreground mb-6">
        Your MT5 account is connected. Every trade you close from here on lands in your journal automatically.
      </p>

      {mt5?.metrics && (
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Balance
            </div>
            <div className="text-lg font-black text-foreground mt-1">
              ${parseFloat(mt5.metrics.balance).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Equity
            </div>
            <div className="text-lg font-black text-foreground mt-1">
              ${parseFloat(mt5.metrics.equity).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={onGoNow}
        className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest gap-1.5"
        data-testid="button-go-to-dashboard"
      >
        Go to dashboard
        <ArrowRight size={14} />
      </Button>
      <div className="mt-4 text-xs text-muted-foreground" data-testid="text-auto-redirect">
        Taking you to the dashboard in {secondsLeft}s…
      </div>
      <div className="mt-3">
        <Badge variant="outline" className="text-[10px]">
          Your sample data was just replaced with your real account
        </Badge>
      </div>
    </div>
  );
}

export default function MT5Bridge() {
  const [step, setStep] = useState<Step>(0);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [os, setOs] = useState<"windows" | "mac">("windows");
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
    staleTime: 0,
  });
  const currentUserId = user?.userId;

  const { data: userRoleData } = useQuery<any>({
    queryKey: [`/api/traders-hub/user-role/${currentUserId}`],
    enabled: !!currentUserId,
  });

  const { data: mt5 } = useQuery<{
    status: string;
    metrics?: {
      balance: string;
      equity: string;
      floatingPl: string;
      positions: any[];
    };
  }>({
    queryKey: [`/api/mt5/status/${currentUserId}`],
    refetchInterval: step >= 4 ? 3000 : 8000,
    staleTime: 0,
    enabled: !!currentUserId,
  });

  const isConnected = mt5?.status === "CONNECTED";
  const hasToken = !!userRoleData?.syncToken;

  // Auto-detect OS
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("mac");
    else setOs("windows");
  }, []);

  // Auto-advance to "Done" once we detect the first connection while on
  // the verify step.
  useEffect(() => {
    if (step === 4 && isConnected) {
      trackEvent("mt5_first_sync_success");
      setStep(5);
    }
  }, [step, isConnected]);

  // Instrumentation
  useEffect(() => {
    trackEvent("wizard_step_completed", { step });
  }, [step]);

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/traders-hub/generate-token", {
        userId: currentUserId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/traders-hub/user-role/${currentUserId}`],
      });
      toast({
        title: "Token Generated",
        description: "Your sync token is ready. Copy it into the connector when prompted.",
      });
    },
  });

  const copyToken = () => {
    if (!userRoleData?.syncToken) return;
    navigator.clipboard.writeText(userRoleData.syncToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [copiedScript, setCopiedScript] = useState(false);
  const copyScript = () => {
    if (!currentUserId || !userRoleData?.syncToken) {
      toast({
        title: "Generate a token first",
        description: "Go back to Step 2 before copying the script.",
        variant: "destructive",
      });
      return;
    }
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/mt5/sync`;
    const populated = MT5_CONNECTOR_PYTHON
      .replace(/__TRADIFY_USER_ID__/g, currentUserId)
      .replace(/__TRADIFY_SYNC_TOKEN__/g, userRoleData.syncToken)
      .replace(/__TRADIFY_API_URL__/g, apiUrl);
    navigator.clipboard.writeText(populated);
    setCopiedScript(true);
    setDownloaded(true); // unlock the Continue button — copy is a valid path
    setTimeout(() => setCopiedScript(false), 2500);
    toast({
      title: "Script copied",
      description: "Paste it into a new file named tradify_connector.pyw on your trading machine.",
    });
  };

  const downloadConnector = () => {
    if (!currentUserId || !userRoleData?.syncToken) {
      toast({
        title: "Generate a token first",
        description: "Go back to Step 2 and generate your sync token before downloading.",
        variant: "destructive",
      });
      return;
    }
    const apiUrl = `${window.location.protocol}//${window.location.host}/api/mt5/sync`;
    const populated = MT5_CONNECTOR_PYTHON
      .replace(/__TRADIFY_USER_ID__/g, currentUserId)
      .replace(/__TRADIFY_SYNC_TOKEN__/g, userRoleData.syncToken)
      .replace(/__TRADIFY_API_URL__/g, apiUrl);
    const file = new Blob([populated], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = "tradify_connector.pyw";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
    toast({
      title: "Connector downloaded",
      description: "Open tradify_connector.pyw on your trading machine.",
    });
  };

  const troubleshooting = useMemo(
    () => [
      {
        q: "MT5 connection failed / init error",
        a: "Make sure MetaTrader 5 is installed and running, and that you're logged into a trading account. Keep MT5 open in the background while the connector runs.",
      },
      {
        q: "Auth Error: Invalid or expired token",
        a: "Regenerate a fresh token in Step 2, then redownload the connector and paste the new token into it.",
      },
      {
        q: "Network error / connection timeout",
        a: "Check your internet. The connector retries automatically every 10 seconds.",
      },
      {
        q: "ModuleNotFoundError: No module named 'MetaTrader5'",
        a: "Install the dependencies: pip install MetaTrader5 requests. The MetaTrader5 package is Windows-only.",
      },
      {
        q: "Trades not appearing on dashboard",
        a: "The connector syncs every 10 seconds and only closed trades land in the journal. Make sure the connector window shows CONNECTED.",
      },
    ],
    []
  );

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background" data-testid="page-mt5-bridge">
      <main className="p-4 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-md">
              <Cpu className="text-emerald-500" size={22} />
            </div>
            <div>
              <h1
                className="text-2xl font-bold text-foreground uppercase tracking-tight"
                data-testid="text-page-title"
              >
                Connect MT5
              </h1>
              <p className="text-sm text-muted-foreground">
                Six steps · about 5 minutes · works on any MT5 broker
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            {isConnected ? (
              <>
                <Wifi size={14} className="text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-500" data-testid="text-status-pill">
                  Connected
                </span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground" data-testid="text-status-pill">
                  Not connected
                </span>
              </>
            )}
          </div>
        </div>

        <StepperHeader current={step} />

        <Card className="p-6 md:p-8">
          {/* STEP 0 — Intro */}
          {step === 0 && (
            <div data-testid="wizard-step-intro">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Step 1 of 6
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                Let's get your trades flowing
              </h2>
              <p className="text-muted-foreground mb-6">
                We'll connect MetaTrader 5 to Tradify in 6 short steps. Your trades will sync automatically — every 10 seconds — and we'll start surfacing patterns, risk flags, and prop firm progress in real time.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  { icon: ShieldCheck, label: "Read-only", body: "We never place trades. The connector only reads from MT5." },
                  { icon: Monitor, label: "Local-first", body: "Runs on your trading machine alongside MT5." },
                  { icon: RefreshCw, label: "Auto-syncs", body: "Pings every 10 seconds. Closed trades are journaled." },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-background/40 p-4">
                    <item.icon size={18} className="text-emerald-500 mb-2" />
                    <div className="text-xs font-black uppercase tracking-widest text-foreground">{item.label}</div>
                    <p className="text-xs text-muted-foreground mt-1">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                <strong className="text-foreground">You'll need:</strong> a Windows or Mac machine with MetaTrader 5 installed, Python 3.8+ (already on most systems), and your MT5 terminal logged in to your trading account.
              </div>

              <NavRow
                hideBack
                onNext={() => setStep(1)}
                nextLabel="Start setup"
              />
            </div>
          )}

          {/* STEP 1 — Generate token */}
          {step === 1 && (
            <div data-testid="wizard-step-token">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Key size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Step 2 of 6
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                Generate your sync token
              </h2>
              <p className="text-muted-foreground mb-6">
                This one-time token authenticates the connector with your account. We'll bake it into the connector file you download next.
              </p>

              {hasToken ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">
                    Your token
                  </div>
                  <div className="flex items-center gap-2">
                    <code
                      className="flex-1 rounded-lg bg-background border border-border px-3 py-2 font-mono text-xs break-all"
                      data-testid="text-sync-token"
                    >
                      {userRoleData.syncToken}
                    </code>
                    <Button
                      onClick={copyToken}
                      variant="outline"
                      size="sm"
                      data-testid="button-copy-token"
                      className="gap-1.5"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Keep this private. If it leaks, regenerate it.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background/40 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No token yet. Click below to generate one.
                  </p>
                  <Button
                    onClick={() => generateTokenMutation.mutate()}
                    disabled={generateTokenMutation.isPending}
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest gap-1.5"
                    data-testid="button-generate-token"
                  >
                    {generateTokenMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Key size={14} />
                    )}
                    Generate Token
                  </Button>
                </div>
              )}

              {hasToken && (
                <div className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
                  <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Need to invalidate this token?{" "}
                    <button
                      type="button"
                      onClick={() => generateTokenMutation.mutate()}
                      className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2"
                      data-testid="button-regenerate-token"
                    >
                      Regenerate
                    </button>
                    .
                  </span>
                </div>
              )}

              <NavRow
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                nextDisabled={!hasToken}
              />
            </div>
          )}

          {/* STEP 2 — Download connector */}
          {step === 2 && (
            <div data-testid="wizard-step-download">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Download size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Step 3 of 6
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                Download the connector
              </h2>
              <p className="text-muted-foreground mb-6">
                The connector is a small Python app. Save it on the same machine where MetaTrader 5 is running.
              </p>

              <div className="rounded-xl border border-border bg-background/40 p-6 text-center">
                <Download className="mx-auto text-emerald-500 mb-3" size={28} />
                <p className="text-sm font-bold text-foreground mb-1">
                  tradify_connector.pyw
                </p>
                <p className="text-xs text-muted-foreground mb-5">
                  ~22 KB · safe to inspect — it's plain text
                </p>
                <Button
                  onClick={downloadConnector}
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest gap-1.5"
                  data-testid="button-download-connector"
                >
                  <Download size={14} />
                  Download connector
                </Button>
                {downloaded && (
                  <p className="mt-3 text-xs text-emerald-500 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} /> Downloaded — find it in your Downloads folder
                  </p>
                )}
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>Download blocked?</span>
                  <button
                    type="button"
                    onClick={copyScript}
                    className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-400 underline underline-offset-2"
                    data-testid="button-copy-script"
                  >
                    {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                    {copiedScript ? "Script copied" : "Copy script to clipboard"}
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
                <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  Your sync token is loaded automatically when you launch the
                  connector — no manual paste required.
                </span>
              </div>

              <NavRow
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                nextDisabled={!downloaded}
              />
            </div>
          )}

          {/* STEP 3 — Run */}
          {step === 3 && (
            <div data-testid="wizard-step-run">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Play size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Step 4 of 6
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                Run the connector
              </h2>
              <p className="text-muted-foreground mb-5">
                Launch MetaTrader 5 first, then double-click the connector you just downloaded.
              </p>

              <div className="mb-5 inline-flex rounded-full border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setOs("windows")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full",
                    os === "windows" ? "bg-emerald-500 text-slate-950" : "text-muted-foreground"
                  )}
                  data-testid="button-os-windows"
                >
                  Windows
                </button>
                <button
                  type="button"
                  onClick={() => setOs("mac")}
                  className={cn(
                    "px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full",
                    os === "mac" ? "bg-emerald-500 text-slate-950" : "text-muted-foreground"
                  )}
                  data-testid="button-os-mac"
                >
                  Mac
                </button>
              </div>

              {os === "windows" ? (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">1</span>
                    Open MetaTrader 5 and log into your trading account.
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">2</span>
                    Double-click <code className="rounded bg-muted px-1.5 py-0.5 text-xs">tradify_connector.pyw</code> from your Downloads folder.
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">3</span>
                    A small window appears. The connector installs its dependencies on first launch — this can take ~30 seconds.
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">4</span>
                    Watch for the green "CONNECTED" badge in the connector window. Then come back here and click Continue.
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">1</span>
                    The official MetaTrader 5 Python package only ships for Windows.
                    On Mac, run MT5 inside CrossOver or Parallels and follow the
                    Windows instructions inside that VM.
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">2</span>
                    Inside the Windows environment: install Python 3.8+, then run{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      pip install MetaTrader5 requests
                    </code>
                    .
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">3</span>
                    Copy the downloaded connector into the VM and double-click it.
                  </li>
                </ol>
              )}

              <div className="mt-5 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="opened-connector"
                  checked={hasOpened}
                  onChange={(e) => setHasOpened(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-emerald-500"
                  data-testid="checkbox-connector-opened"
                />
                <label htmlFor="opened-connector" className="text-sm text-muted-foreground cursor-pointer">
                  I've launched the connector
                </label>
              </div>

              <NavRow
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                nextDisabled={!hasOpened}
                nextLabel="Verify connection"
              />
            </div>
          )}

          {/* STEP 4 — Verify */}
          {step === 4 && (
            <div data-testid="wizard-step-verify">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <RefreshCw size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Step 5 of 6
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                Verifying connection…
              </h2>
              <p className="text-muted-foreground mb-6">
                We're polling for the first sync from your connector. This usually
                takes 10–30 seconds.
              </p>

              <div
                className={cn(
                  "rounded-2xl border p-8 text-center transition-colors",
                  isConnected
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-border bg-background/40"
                )}
                data-testid="verify-status"
              >
                {isConnected ? (
                  <>
                    <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} />
                    <p className="text-lg font-black uppercase tracking-tight italic text-foreground">
                      Connected!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      First sync received. Taking you to the success screen…
                    </p>
                  </>
                ) : (
                  <>
                    <Loader2 className="mx-auto text-emerald-500 mb-3 animate-spin" size={40} />
                    <p className="text-sm font-bold text-foreground">
                      Waiting for first sync from your connector
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Make sure the connector window shows "CONNECTED" — and that MT5 is open.
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowTroubleshooting((s) => !s)}
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                data-testid="button-troubleshoot-toggle"
              >
                <HelpCircle size={14} />
                {showTroubleshooting ? "Hide" : "Show"} troubleshooting
              </button>

              {showTroubleshooting && (
                <div className="mt-4 space-y-2">
                  {troubleshooting.map((t, i) => (
                    <details
                      key={i}
                      className="rounded-xl border border-border bg-background/40 p-3 text-sm"
                      data-testid={`troubleshooting-item-${i}`}
                    >
                      <summary className="cursor-pointer font-bold text-foreground flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        {t.q}
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground">{t.a}</p>
                    </details>
                  ))}
                </div>
              )}

              <NavRow
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                nextDisabled={!isConnected}
                nextLabel="See success"
              />
            </div>
          )}

          {/* STEP 5 — Done. Auto-redirects to /dashboard after a short pause */}
          {step === 5 && (
            <DoneStep
              mt5={mt5}
              onGoNow={() => navigate("/dashboard")}
            />
          )}
        </Card>

        {/* Live status pill — visible from step 4 onwards */}
        {step >= 4 && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Live status:{" "}
            <span
              className={cn(
                "font-bold",
                isConnected ? "text-emerald-500" : "text-muted-foreground"
              )}
            >
              {isConnected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
