import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

function trackEvent(name: string, params?: Record<string, any>) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  } catch {}
}

function StepperHeader({ current }: { current: Step }) {
  const { t } = useTranslation();
  const stepMeta = [
    { title: t("mt5Bridge.step0Title") },
    { title: t("mt5Bridge.step1Title") },
    { title: t("mt5Bridge.step2Title") },
    { title: t("mt5Bridge.step3Title") },
    { title: t("mt5Bridge.step4Title") },
    { title: t("mt5Bridge.step5Title") },
  ];
  return (
    <div className="mb-8" data-testid="wizard-stepper">
      <ol className="grid grid-cols-6 gap-2">
        {stepMeta.map((s, i) => {
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
  nextLabel,
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
  const { t } = useTranslation();
  const label = nextLabel || t("mt5Bridge.navContinue");
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
          {t("mt5Bridge.navBack")}
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
            {label}
            <ChevronRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

function DoneStep({
  mt5,
  onGoNow,
}: {
  mt5: any;
  onGoNow: () => void;
}) {
  const { t } = useTranslation();
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
        {t("mt5Bridge.doneHeading")}
      </h2>
      <p className="text-muted-foreground mb-6">
        {t("mt5Bridge.doneBody")}
      </p>

      {mt5?.metrics && (
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6">
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t("mt5Bridge.doneBalance")}
            </div>
            <div className="text-lg font-black text-foreground mt-1">
              ${parseFloat(mt5.metrics.balance).toLocaleString()}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t("mt5Bridge.doneEquity")}
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
        {t("mt5Bridge.doneCta")}
        <ArrowRight size={14} />
      </Button>
      <div className="mt-4 text-xs text-muted-foreground" data-testid="text-auto-redirect">
        {t("mt5Bridge.doneAutoRedirect", { seconds: secondsLeft })}
      </div>
      <div className="mt-3">
        <Badge variant="outline" className="text-[10px]">
          {t("mt5Bridge.doneSampleReplaced")}
        </Badge>
      </div>
    </div>
  );
}

export default function MT5Bridge() {
  const { t } = useTranslation();
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

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) setOs("mac");
    else setOs("windows");
  }, []);

  useEffect(() => {
    if (step === 4 && isConnected) {
      trackEvent("mt5_first_sync_success");
      setStep(5);
    }
  }, [step, isConnected]);

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
        title: t("mt5Bridge.toastTokenGenerated"),
        description: t("mt5Bridge.toastTokenGeneratedDesc"),
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
        title: t("mt5Bridge.toastGenerateFirst"),
        description: t("mt5Bridge.toastGenerateFirstCopy"),
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
    setDownloaded(true);
    setTimeout(() => setCopiedScript(false), 2500);
    toast({
      title: t("mt5Bridge.toastScriptCopied"),
      description: t("mt5Bridge.toastScriptCopiedDesc"),
    });
  };

  const downloadConnector = () => {
    if (!currentUserId || !userRoleData?.syncToken) {
      toast({
        title: t("mt5Bridge.toastGenerateFirst"),
        description: t("mt5Bridge.toastGenerateFirstDownload"),
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
      title: t("mt5Bridge.toastConnectorDownloaded"),
      description: t("mt5Bridge.toastConnectorDownloadedDesc"),
    });
  };

  const troubleshooting = useMemo(
    () => [
      { q: t("mt5Bridge.ts1Q"), a: t("mt5Bridge.ts1A") },
      { q: t("mt5Bridge.ts2Q"), a: t("mt5Bridge.ts2A") },
      { q: t("mt5Bridge.ts3Q"), a: t("mt5Bridge.ts3A") },
      { q: t("mt5Bridge.ts4Q"), a: t("mt5Bridge.ts4A") },
      { q: t("mt5Bridge.ts5Q"), a: t("mt5Bridge.ts5A") },
    ],
    [t]
  );

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background" data-testid="page-mt5-bridge">
      <main className="p-4 lg:p-8 max-w-4xl mx-auto">
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
                {t("mt5Bridge.pageTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("mt5Bridge.pageSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            {isConnected ? (
              <>
                <Wifi size={14} className="text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-500" data-testid="text-status-pill">
                  {t("mt5Bridge.statusConnected")}
                </span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground" data-testid="text-status-pill">
                  {t("mt5Bridge.statusNotConnected")}
                </span>
              </>
            )}
          </div>
        </div>

        <StepperHeader current={step} />

        <Card className="p-6 md:p-8">
          {step === 0 && (
            <div data-testid="wizard-step-intro">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t("mt5Bridge.stepOfTotal", { current: 1, total: 6 })}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                {t("mt5Bridge.introHeading")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("mt5Bridge.introBody")}
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  { icon: ShieldCheck, label: t("mt5Bridge.cardReadOnlyLabel"), body: t("mt5Bridge.cardReadOnlyBody") },
                  { icon: Monitor, label: t("mt5Bridge.cardLocalLabel"), body: t("mt5Bridge.cardLocalBody") },
                  { icon: RefreshCw, label: t("mt5Bridge.cardSyncLabel"), body: t("mt5Bridge.cardSyncBody") },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-background/40 p-4">
                    <item.icon size={18} className="text-emerald-500 mb-2" />
                    <div className="text-xs font-black uppercase tracking-widest text-foreground">{item.label}</div>
                    <p className="text-xs text-muted-foreground mt-1">{item.body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                <strong className="text-foreground">{t("mt5Bridge.introYouNeed")}</strong>{t("mt5Bridge.introNeedBody")}
              </div>

              <NavRow
                hideBack
                onNext={() => setStep(1)}
                nextLabel={t("mt5Bridge.introCta")}
              />
            </div>
          )}

          {step === 1 && (
            <div data-testid="wizard-step-token">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Key size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t("mt5Bridge.stepOfTotal", { current: 2, total: 6 })}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                {t("mt5Bridge.tokenHeading")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("mt5Bridge.tokenBody")}
              </p>

              {hasToken ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-2">
                    {t("mt5Bridge.tokenYour")}
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
                      {copied ? t("mt5Bridge.tokenCopied") : t("mt5Bridge.tokenCopy")}
                    </Button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {t("mt5Bridge.tokenPrivate")}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background/40 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("mt5Bridge.tokenNoneYet")}
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
                    {t("mt5Bridge.tokenGenerate")}
                  </Button>
                </div>
              )}

              {hasToken && (
                <div className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
                  <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    {t("mt5Bridge.tokenInvalidate")}
                    <button
                      type="button"
                      onClick={() => generateTokenMutation.mutate()}
                      className="text-emerald-500 hover:text-emerald-400 underline underline-offset-2"
                      data-testid="button-regenerate-token"
                    >
                      {t("mt5Bridge.tokenRegenerate")}
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

          {step === 2 && (
            <div data-testid="wizard-step-download">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Download size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t("mt5Bridge.stepOfTotal", { current: 3, total: 6 })}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                {t("mt5Bridge.downloadHeading")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("mt5Bridge.downloadBody")}
              </p>

              <div className="rounded-xl border border-border bg-background/40 p-6 text-center">
                <Download className="mx-auto text-emerald-500 mb-3" size={28} />
                <p className="text-sm font-bold text-foreground mb-1">
                  {t("mt5Bridge.downloadFile")}
                </p>
                <p className="text-xs text-muted-foreground mb-5">
                  {t("mt5Bridge.downloadFileMeta")}
                </p>
                <Button
                  onClick={downloadConnector}
                  className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-bold uppercase tracking-widest gap-1.5"
                  data-testid="button-download-connector"
                >
                  <Download size={14} />
                  {t("mt5Bridge.downloadCta")}
                </Button>
                {downloaded && (
                  <p className="mt-3 text-xs text-emerald-500 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} /> {t("mt5Bridge.downloadDone")}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>{t("mt5Bridge.downloadBlocked")}</span>
                  <button
                    type="button"
                    onClick={copyScript}
                    className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-400 underline underline-offset-2"
                    data-testid="button-copy-script"
                  >
                    {copiedScript ? <Check size={12} /> : <Copy size={12} />}
                    {copiedScript ? t("mt5Bridge.copyScriptDone") : t("mt5Bridge.copyScript")}
                  </button>
                </div>
              </div>

              <div className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
                <Info size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  {t("mt5Bridge.downloadInfo")}
                </span>
              </div>

              <NavRow
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                nextDisabled={!downloaded}
              />
            </div>
          )}

          {step === 3 && (
            <div data-testid="wizard-step-run">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Play size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t("mt5Bridge.stepOfTotal", { current: 4, total: 6 })}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                {t("mt5Bridge.runHeading")}
              </h2>
              <p className="text-muted-foreground mb-5">
                {t("mt5Bridge.runBody")}
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
                  {t("mt5Bridge.osWindows")}
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
                  {t("mt5Bridge.osMac")}
                </button>
              </div>

              {os === "windows" ? (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">1</span>
                    {t("mt5Bridge.winStep1")}
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">2</span>
                    <span>
                      {t("mt5Bridge.winStep2Pre")}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">tradify_connector.pyw</code>
                      {t("mt5Bridge.winStep2Post")}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">3</span>
                    {t("mt5Bridge.winStep3")}
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">4</span>
                    {t("mt5Bridge.winStep4")}
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">1</span>
                    {t("mt5Bridge.macStep1")}
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">2</span>
                    <span>
                      {t("mt5Bridge.macStep2Pre")}
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        pip install MetaTrader5 requests
                      </code>
                      {t("mt5Bridge.macStep2Post")}
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">3</span>
                    {t("mt5Bridge.macStep3")}
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
                  {t("mt5Bridge.runLaunched")}
                </label>
              </div>

              <NavRow
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                nextDisabled={!hasOpened}
                nextLabel={t("mt5Bridge.runVerifyCta")}
              />
            </div>
          )}

          {step === 4 && (
            <div data-testid="wizard-step-verify">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <RefreshCw size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {t("mt5Bridge.stepOfTotal", { current: 5, total: 6 })}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic mb-3">
                {t("mt5Bridge.verifyHeading")}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("mt5Bridge.verifyBody")}
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
                      {t("mt5Bridge.verifySuccess")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("mt5Bridge.verifySuccessDesc")}
                    </p>
                  </>
                ) : (
                  <>
                    <Loader2 className="mx-auto text-emerald-500 mb-3 animate-spin" size={40} />
                    <p className="text-sm font-bold text-foreground">
                      {t("mt5Bridge.verifyWaiting")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {t("mt5Bridge.verifyWaitingDesc")}
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
                {showTroubleshooting ? t("mt5Bridge.troubleshootHide") : t("mt5Bridge.troubleshootShow")}
              </button>

              {showTroubleshooting && (
                <div className="mt-4 space-y-2">
                  {troubleshooting.map((tt, i) => (
                    <details
                      key={i}
                      className="rounded-xl border border-border bg-background/40 p-3 text-sm"
                      data-testid={`troubleshooting-item-${i}`}
                    >
                      <summary className="cursor-pointer font-bold text-foreground flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        {tt.q}
                      </summary>
                      <p className="mt-2 text-xs text-muted-foreground">{tt.a}</p>
                    </details>
                  ))}
                </div>
              )}

              <NavRow
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                nextDisabled={!isConnected}
                nextLabel={t("mt5Bridge.verifyCta")}
              />
            </div>
          )}

          {step === 5 && (
            <DoneStep
              mt5={mt5}
              onGoNow={() => navigate("/dashboard")}
            />
          )}
        </Card>

        {step >= 4 && (
          <div className="mt-6 text-center text-xs text-muted-foreground">
            {t("mt5Bridge.liveStatus")}{" "}
            <span
              className={cn(
                "font-bold",
                isConnected ? "text-emerald-500" : "text-muted-foreground"
              )}
            >
              {isConnected ? t("mt5Bridge.liveOnline") : t("mt5Bridge.liveOffline")}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
