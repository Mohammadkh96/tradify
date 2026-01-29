import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  BookOpen, 
  Target, 
  Calculator, 
  Zap, 
  Users,
  User,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  highlight: string;
  position: "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Tradify",
    description: "Your trading journal and discipline platform. Let me show you around the portal in about 60 seconds.",
    icon: Sparkles,
    highlight: "",
    position: "center",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Your command center. View performance metrics, equity curves, win rates, and key statistics at a glance. Filter by date ranges to analyze specific periods.",
    icon: LayoutDashboard,
    highlight: "nav-dashboard",
    position: "right",
  },
  {
    id: "strategies",
    title: "Strategies",
    description: "Define your trading frameworks with specific rules. Create strategies, validate trades against your rules, and track your discipline compliance.",
    icon: Target,
    highlight: "nav-strategies-toggle",
    position: "right",
  },
  {
    id: "calculator",
    title: "Calculators",
    description: "Discipline tools to quantify risk before you trade. Calculate position sizes, risk-reward ratios, drawdown recovery, and more.",
    icon: Calculator,
    highlight: "nav-calculator",
    position: "right",
  },
  {
    id: "mt5",
    title: "MT5 Bridge",
    description: "Connect your MetaTrader 5 account to automatically sync trades. Your trading data imports seamlessly for analysis.",
    icon: Zap,
    highlight: "nav-mt5-bridge",
    position: "right",
  },
  {
    id: "education",
    title: "Education",
    description: "Access the knowledge base with trading concepts, risk management frameworks, and market structure education.",
    icon: BookOpen,
    highlight: "nav-education",
    position: "right",
  },
  {
    id: "community",
    title: "Traders Hub",
    description: "Connect with other traders, share insights, and learn from the community. Discuss strategies and market observations.",
    icon: Users,
    highlight: "nav-traders-hub",
    position: "right",
  },
  {
    id: "profile",
    title: "Profile & Settings",
    description: "Manage your account, subscription, and preferences. Upgrade to Pro for unlimited strategies and advanced features.",
    icon: User,
    highlight: "nav-profile",
    position: "right",
  },
];

const TOUR_STORAGE_KEY = "tradify_tour_completed";

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousHighlightRef = useRef<Element | null>(null);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      const timer = setTimeout(() => {
        setHasCompletedTour(false);
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setHasCompletedTour(true);
    setIsOpen(false);
    setCurrentStep(0);
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const restartTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") skipTour();
      if (e.key === "ArrowRight") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, nextStep, prevStep, skipTour]);

  useEffect(() => {
    if (previousHighlightRef.current) {
      previousHighlightRef.current.classList.remove("tour-highlight");
      previousHighlightRef.current = null;
    }
    
    if (!isOpen) return;
    
    const step = tourSteps[currentStep];
    if (step.highlight) {
      const element = document.querySelector(`[data-testid="${step.highlight}"]`);
      if (element) {
        element.classList.add("tour-highlight");
        previousHighlightRef.current = element;
      }
    }
    
    return () => {
      if (previousHighlightRef.current) {
        previousHighlightRef.current.classList.remove("tour-highlight");
        previousHighlightRef.current = null;
      }
    };
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Add tour-active class to body when tour is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("tour-active");
    } else {
      document.body.classList.remove("tour-active");
    }
    return () => {
      document.body.classList.remove("tour-active");
    };
  }, [isOpen]);

  if (hasCompletedTour && !isOpen) {
    return (
      <button
        onClick={restartTour}
        data-testid="button-restart-tour"
        className="fixed bottom-4 left-4 z-50 hidden md:flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
      >
        <Sparkles size={14} />
        Tour
      </button>
    );
  }

  const step = tourSteps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Dark overlay without blur so highlighted items are clearly visible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/90 z-[100]"
            onClick={skipTour}
          />

          {/* Professional tour card with gradient border and glow */}
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
              step.position === "right" && "top-1/2 left-1/2 md:left-[calc(256px+2rem)] -translate-y-1/2 md:translate-x-0 -translate-x-1/2",
              step.position === "left" && "top-1/2 right-8 -translate-y-1/2"
            )}
          >
            {/* Outer glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20 rounded-2xl blur-xl" />
            
            {/* Gradient border wrapper */}
            <div className="relative p-[1px] rounded-2xl bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-transparent">
              <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
                
                {/* Animated progress bar */}
                <div className="h-1 bg-slate-800">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>

                {/* Header section */}
                <div className="p-6 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {/* Icon with gradient background */}
                      <motion.div 
                        className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30"
                        animate={{ 
                          boxShadow: ["0 0 20px rgba(16, 185, 129, 0.2)", "0 0 30px rgba(16, 185, 129, 0.4)", "0 0 20px rgba(16, 185, 129, 0.2)"]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Icon size={26} className="text-emerald-400" />
                      </motion.div>
                      <div>
                        <h3 className="font-black text-xl text-white uppercase tracking-wide">
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

                {/* Content section */}
                <div className="px-6 py-5">
                  <p className="text-slate-400 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Navigation section */}
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

                    {/* Step indicators */}
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
                              : "w-2 bg-slate-600"
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
                      {currentStep === tourSteps.length - 1 ? "Finish" : "Next"}
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>

                {/* Footer */}
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
        </>
      )}
    </AnimatePresence>
  );
}
