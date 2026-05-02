import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Target,
  Calculator,
  Zap,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useSampleMode } from "@/hooks/useSampleMode";
import { Link } from "react-router-dom";

export const TOUR_RESTART_EVENT = "tradify:restart-tour";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  highlight: string;
  position: "left" | "right" | "center";
  cta?: { label: string; to: string; testId: string };
}

const baseSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to TradifyApp",
    description:
      "60 seconds and you'll know exactly how this protects your prop firm challenge. Let's go.",
    icon: Sparkles,
    highlight: "",
    position: "center",
  },
  {
    id: "dashboard",
    title: "Your live command center",
    description:
      "Equity curve, win rate, drawdown — all live. Filter any date range to spot patterns instantly.",
    icon: LayoutDashboard,
    highlight: "nav-dashboard",
    position: "right",
  },
  {
    id: "risk-flags",
    title: "Behavioral risk alerts",
    description:
      "We watch for revenge trading, overtrading, and strategy deviation in real time — and warn you before they cost you the challenge.",
    icon: ShieldAlert,
    highlight: "card-behavioral-risk-flags",
    position: "center",
  },
  {
    id: "strategies",
    title: "Strategy discipline",
    description:
      "Define your rules once, then every trade is auto-validated against them. Catch the moment you start drifting.",
    icon: Target,
    highlight: "nav-strategies-toggle",
    position: "right",
  },
  {
    id: "calculator",
    title: "One-click risk math",
    description:
      "Position size, drawdown recovery, R-multiple — the floating calculator (bottom-right) does the math so you don't have to.",
    icon: Calculator,
    highlight: "button-floating-calculator",
    position: "left",
  },
];

const sampleFinalStep: TourStep = {
  id: "connect-real",
  title: "Make it real — connect MT5",
  description:
    "What you're seeing right now is sample data. Connect your MetaTrader 5 account and TradifyApp will track YOUR challenge live in 2 minutes.",
  icon: Rocket,
  highlight: "nav-mt5-bridge",
  position: "right",
  cta: { label: "Connect MT5 now", to: "/mt5-bridge", testId: "button-tour-cta-mt5" },
};

const liveFinalStep: TourStep = {
  id: "you-are-set",
  title: "You're all set",
  description:
    "TradifyApp is now watching every trade. You'll get alerts the moment a rule is at risk. Now go pass that challenge.",
  icon: TrendingUp,
  highlight: "",
  position: "center",
  cta: { label: "Go to dashboard", to: "/dashboard", testId: "button-tour-cta-dashboard" },
};

const TOUR_STORAGE_KEY = "tradify_tour_completed";

interface UserResponse {
  id?: string;
  hasSeenTour?: boolean;
  [k: string]: unknown;
}

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousHighlightRef = useRef<Element | null>(null);

  const { data: user, isLoading: userLoading } = useQuery<UserResponse | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });

  const { active: sampleActive } = useSampleMode();

  const finalStep = sampleActive ? sampleFinalStep : liveFinalStep;
  const tourSteps = useMemo<TourStep[]>(() => [...baseSteps, finalStep], [finalStep]);

  const markCompleteMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/user/tour-complete"),
    onSuccess: () => {
      queryClient.setQueryData<UserResponse | null>(["/api/user"], (prev) =>
        prev ? { ...prev, hasSeenTour: true } : prev,
      );
    },
  });

  // Auto-open for first-time users (server-state-aware, not just localStorage).
  useEffect(() => {
    if (userLoading) return;
    if (!user) return; // logged-out
    const localDone = (() => {
      try {
        return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
      } catch {
        return false;
      }
    })();
    if (user.hasSeenTour || localDone) return;
    const t = setTimeout(() => setIsOpen(true), 1000);
    return () => clearTimeout(t);
  }, [user, userLoading]);

  const closeAndPersist = useCallback(() => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } catch {}
    if (user && !user.hasSeenTour && !markCompleteMutation.isPending) {
      markCompleteMutation.mutate();
    }
    setIsOpen(false);
    setCurrentStep(0);
  }, [user, markCompleteMutation]);

  // Clamp step if tourSteps shrinks (e.g., sampleActive flips while open)
  useEffect(() => {
    if (currentStep >= tourSteps.length) {
      setCurrentStep(Math.max(0, tourSteps.length - 1));
    }
  }, [currentStep, tourSteps.length]);

  const skipTour = useCallback(() => {
    closeAndPersist();
  }, [closeAndPersist]);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      closeAndPersist();
    }
  }, [currentStep, tourSteps.length, closeAndPersist]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  }, [currentStep]);

  const restartTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTour();
      else if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, nextStep, prevStep, skipTour]);

  // Highlight target element
  useEffect(() => {
    if (previousHighlightRef.current) {
      previousHighlightRef.current.classList.remove("tour-highlight");
      previousHighlightRef.current = null;
    }
    if (!isOpen) return;
    const step = tourSteps[currentStep];
    if (step?.highlight) {
      const el = document.querySelector(`[data-testid="${step.highlight}"]`);
      if (el) {
        el.classList.add("tour-highlight");
        previousHighlightRef.current = el;
      }
    }
    return () => {
      if (previousHighlightRef.current) {
        previousHighlightRef.current.classList.remove("tour-highlight");
        previousHighlightRef.current = null;
      }
    };
  }, [isOpen, currentStep, tourSteps]);

  useEffect(() => {
    if (isOpen && panelRef.current) panelRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.classList.add("tour-active");
    else document.body.classList.remove("tour-active");
    return () => document.body.classList.remove("tour-active");
  }, [isOpen]);

  useEffect(() => {
    const handler = () => restartTour();
    window.addEventListener(TOUR_RESTART_EVENT, handler);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, handler);
  }, [restartTour]);

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  if (!step) return null;
  const Icon = step.icon;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const isLast = currentStep === tourSteps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/90 z-[100]"
        onClick={skipTour}
        data-testid="tour-overlay"
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "fixed z-[101] w-[90vw] max-w-lg outline-none",
          step.position === "center" && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          step.position === "right" &&
            "top-1/2 left-1/2 md:left-[calc(256px+2rem)] -translate-y-1/2 md:translate-x-0 -translate-x-1/2",
          step.position === "left" && "top-1/2 right-8 -translate-y-1/2",
        )}
        data-testid="tour-panel"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20 rounded-2xl blur-xl" />
        <div className="relative p-[1px] rounded-2xl bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent">
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
            <div className="h-1 bg-slate-800">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <div className="p-6 pb-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30"
                    animate={{
                      boxShadow: [
                        "0 0 20px rgba(16, 185, 129, 0.2)",
                        "0 0 30px rgba(16, 185, 129, 0.4)",
                        "0 0 20px rgba(16, 185, 129, 0.2)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Icon size={26} className="text-emerald-400" />
                  </motion.div>
                  <div>
                    <h3 className="font-black text-xl text-white uppercase tracking-wide" data-testid="text-tour-title">
                      {step.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-widest">
                        Step {currentStep + 1}
                      </span>
                      <span className="text-slate-600">/</span>
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                        {tourSteps.length}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={skipTour}
                  data-testid="button-skip-tour"
                  className="p-2.5 hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-slate-400 text-sm leading-relaxed" data-testid="text-tour-description">
                {step.description}
              </p>

              {step.cta && (
                <Link
                  to={step.cta.to}
                  onClick={closeAndPersist}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:bg-emerald-400 shadow-lg shadow-emerald-500/30 transition-all"
                  data-testid={step.cta.testId}
                >
                  <Zap size={14} />
                  {step.cta.label}
                </Link>
              )}
            </div>

            <div className="px-6 pb-5">
              <div className="flex items-center justify-between gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="gap-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                  data-testid="button-tour-prev"
                >
                  <ChevronLeft size={16} />
                  Back
                </Button>

                <div className="flex gap-2">
                  {tourSteps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        i === currentStep
                          ? "w-8 bg-gradient-to-r from-emerald-400 to-emerald-500"
                          : i < currentStep
                            ? "w-2 bg-emerald-500/60"
                            : "w-2 bg-slate-600",
                      )}
                      data-testid={`button-tour-dot-${i}`}
                    />
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={nextStep}
                  className="gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold shadow-lg shadow-emerald-500/20"
                  data-testid="button-tour-next"
                >
                  {isLast ? "Finish" : "Next"}
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="px-6 pb-4 flex justify-center">
              <button
                onClick={skipTour}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest font-medium"
                data-testid="button-skip-tour-link"
              >
                Skip tour
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
