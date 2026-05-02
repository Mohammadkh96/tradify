import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  BookOpen, TrendingUp, Brain, Target, Heart, Zap,
  Lock, Clock, ChevronRight, Crown, Star, Search,
  GraduationCap, CheckCircle, ArrowLeft, AlertTriangle,
  Lightbulb, Play, XCircle, CircleCheck, Link2, HelpCircle,
  Bookmark, BookmarkCheck, MessageSquare, Send, Loader2,
  ArrowUp, Compass, Layers, Droplets, Crosshair, Shield,
  Trophy, ChevronDown, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlan } from "@/hooks/usePlan";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  EDUCATION_LESSONS,
  EDUCATION_PHASES,
  type Lesson,
  type Phase,
  type QuizQuestion,
  type DiagramType,
  type AccessTier,
  canAccessLesson,
  isLessonUnlocked,
  getPhaseProgress,
} from "@/data/educationLessons";
import { DIAGRAM_TYPES } from "@/components/TradingDiagrams";
import { useTranslation } from "react-i18next";

type LessonProgress = {
  id: number;
  userId: string;
  lessonId: number;
  completed: boolean;
  completedAt: string | null;
};

type LessonBookmark = {
  id: number;
  userId: string;
  lessonId: number;
  createdAt: string;
};

type QuizResult = {
  id: number;
  userId: string;
  lessonId: number;
  score: number;
  totalQuestions: number;
  completedAt: string;
};

const phaseIcons: Record<string, typeof BookOpen> = {
  Compass,
  Layers,
  Droplets,
  Crosshair,
  Target,
  Shield,
  Brain,
  Trophy,
};

const tierBadgeStyles: Record<AccessTier, string> = {
  FREE: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  PRO: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  ELITE: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const phaseColorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  slate: { bg: "bg-slate-500/10", border: "border-slate-500/30", text: "text-slate-400", glow: "shadow-slate-500/20" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500", glow: "shadow-emerald-500/20" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", glow: "shadow-blue-500/20" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/20" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500", glow: "shadow-amber-500/20" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", glow: "shadow-rose-500/20" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", glow: "shadow-purple-500/20" },
};

function LessonNode({
  lesson,
  isUnlocked,
  isCompleted,
  hasAccess,
  quizScore,
  phaseColor,
  onSelect,
}: {
  lesson: Lesson;
  isUnlocked: boolean;
  isCompleted: boolean;
  hasAccess: boolean;
  quizScore: number;
  phaseColor: string;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const colors = phaseColorMap[phaseColor] || phaseColorMap.slate;
  const canOpen = (isUnlocked || isCompleted) && hasAccess;
  const quizPassed = quizScore >= lesson.requiredScore;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: lesson.order * 0.1 }}
      className="relative"
    >
      <button
        onClick={() => canOpen && onSelect(lesson.id)}
        disabled={!canOpen}
        className={cn(
          "w-full text-left p-4 rounded-lg border transition-all duration-200 group",
          canOpen && !isCompleted && "hover-elevate cursor-pointer",
          isCompleted && quizPassed
            ? "border-emerald-500/40 bg-emerald-500/5"
            : isCompleted
              ? "border-amber-500/40 bg-amber-500/5"
              : canOpen
                ? `${colors.border} ${colors.bg}`
                : "border-border/50 bg-muted/30 opacity-60"
        )}
        data-testid={`lesson-node-${lesson.id}`}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black",
            isCompleted && quizPassed
              ? "bg-emerald-500 text-white"
              : isCompleted
                ? "bg-amber-500 text-white"
                : canOpen
                  ? `${colors.bg} ${colors.text} border ${colors.border}`
                  : "bg-muted text-muted-foreground"
          )}>
            {isCompleted && quizPassed ? (
              <CheckCircle size={18} />
            ) : isCompleted ? (
              <span>{lesson.order}</span>
            ) : !canOpen ? (
              <Lock size={14} />
            ) : (
              <span>{lesson.order}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className={cn(
              "font-bold text-sm line-clamp-2 mb-1",
              canOpen ? "text-foreground" : "text-muted-foreground"
            )} data-testid={`text-lesson-title-${lesson.id}`}>
              {lesson.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
              {lesson.description}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                <Clock size={10} />
                <span>{lesson.duration}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                <BookOpen size={10} />
                <span>{t("sections", { count: lesson.sections.length })}</span>
              </div>
              {isCompleted && quizScore > 0 && (
                <Badge variant="outline" className={cn(
                  "text-[10px] font-bold",
                  quizPassed ? "border-emerald-500/30 text-emerald-500" : "border-amber-500/30 text-amber-500"
                )}>
                  {t("quizScore", { score: quizScore })}
                </Badge>
              )}
              {!hasAccess && (
                <Badge variant="outline" className="text-[10px] font-black gap-1">
                  <Lock size={8} />
                  {lesson.accessTier}
                </Badge>
              )}
            </div>
          </div>

          {canOpen && (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>
    </motion.div>
  );
}

function PhaseCard({
  phase,
  lessons,
  completedLessons,
  quizScores,
  userTier,
  onSelectLesson,
  isExpanded,
  onToggleExpand,
}: {
  phase: Phase;
  lessons: Lesson[];
  completedLessons: Set<number>;
  quizScores: Map<number, number>;
  userTier: AccessTier;
  onSelectLesson: (id: number) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const { completed, total, percentage } = getPhaseProgress(phase.id, completedLessons);
  const PhaseIcon = phaseIcons[phase.icon] || BookOpen;
  const colors = phaseColorMap[phase.color] || phaseColorMap.slate;
  const hasAccess = canAccessLesson(lessons[0]?.id ?? 0, userTier);

  const allPhaseLessonsCompleted = completed === total;
  const isPhaseAvailable = lessons.some(l => {
    const unlocked = isLessonUnlocked(l.id, completedLessons, quizScores);
    const accessible = canAccessLesson(l.id, userTier);
    return unlocked && accessible && !completedLessons.has(l.id);
  });

  const nextLesson = lessons.find(l => {
    const unlocked = isLessonUnlocked(l.id, completedLessons, quizScores);
    const accessible = canAccessLesson(l.id, userTier);
    return unlocked && accessible && !completedLessons.has(l.id);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: phase.id * 0.08 }}
      className="relative"
    >
      {phase.id > 0 && (
        <div className="absolute -top-6 left-8 w-0.5 h-6 bg-border" />
      )}

      <Card className={cn(
        "overflow-visible transition-all duration-300",
        allPhaseLessonsCompleted && "border-emerald-500/30",
        isPhaseAvailable && !allPhaseLessonsCompleted && colors.border,
        !hasAccess && "opacity-70"
      )}>
        <button
          onClick={onToggleExpand}
          className="w-full text-left p-4 sm:p-5"
          data-testid={`phase-toggle-${phase.id}`}
        >
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
              allPhaseLessonsCompleted
                ? "bg-emerald-500/10"
                : isPhaseAvailable
                  ? colors.bg
                  : "bg-muted"
            )}>
              <PhaseIcon className={cn(
                "w-6 h-6",
                allPhaseLessonsCompleted
                  ? "text-emerald-500"
                  : isPhaseAvailable
                    ? colors.text
                    : "text-muted-foreground"
              )} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className={cn("text-[10px] font-black", tierBadgeStyles[phase.accessTier])}>
                  {phase.accessTier === "FREE" ? t("tierFree") : phase.accessTier}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {t("phasePrefix", { id: phase.id })}
                </span>
                {allPhaseLessonsCompleted && (
                  <Badge className="bg-emerald-500 text-white text-[10px] font-black gap-1">
                    <CheckCircle size={10} />
                    {t("phaseComplete")}
                  </Badge>
                )}
              </div>

              <h3 className="text-lg font-black text-foreground tracking-tight" data-testid={`text-phase-title-${phase.id}`}>
                {phase.title}
              </h3>
              <p className="text-sm text-muted-foreground italic">{phase.subtitle}</p>

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[200px]">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      allPhaseLessonsCompleted ? "bg-emerald-500" : isPhaseAvailable ? "bg-blue-500" : "bg-muted-foreground/30"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-bold">
                  {completed}/{total}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!hasAccess && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
              <ChevronDown className={cn(
                "w-5 h-5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />
            </div>
          </div>

          {!isExpanded && nextLesson && (
            <div className={cn("mt-3 ml-16 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2", colors.bg, colors.text)}>
              <Play size={12} />
              <span>{t("nextPrefix", { title: nextLesson.title })}</span>
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <p className="text-sm text-muted-foreground mb-4 ml-16">
              {phase.description}
            </p>

            <div className="space-y-3 ml-4 sm:ml-16">
              {lessons.map((lesson) => {
                const unlocked = isLessonUnlocked(lesson.id, completedLessons, quizScores);
                const accessible = canAccessLesson(lesson.id, userTier);
                const lessonCompleted = completedLessons.has(lesson.id);
                const score = quizScores.get(lesson.id) ?? 0;

                return (
                  <LessonNode
                    key={lesson.id}
                    lesson={lesson}
                    isUnlocked={unlocked}
                    isCompleted={lessonCompleted}
                    hasAccess={accessible}
                    quizScore={score}
                    phaseColor={phase.color}
                    onSelect={onSelectLesson}
                  />
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function QuizSection({
  quiz,
  lessonId,
  requiredScore,
  onQuizPass,
}: {
  quiz: QuizQuestion[];
  lessonId: number;
  requiredScore: number;
  onQuizPass?: () => void;
}) {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const saveQuizResultMutation = useMutation({
    mutationFn: async (data: { score: number; totalQuestions: number; answers: Record<number, number> }) => {
      return apiRequest("POST", "/api/education/quiz-results", { lessonId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/quiz-results"] });
    },
  });

  const handleAnswer = (questionId: number, optionIndex: number) => {
    if (showResults) return;
    setAnswers({ ...answers, [questionId]: optionIndex });
  };

  const checkAnswers = () => {
    setShowResults(true);
    const score = quiz.filter(q => answers[q.id] === q.correctAnswer).length;
    const percentage = Math.round((score / quiz.length) * 100);
    saveQuizResultMutation.mutate({
      score,
      totalQuestions: quiz.length,
      answers,
    });
    if (percentage >= requiredScore && onQuizPass) {
      onQuizPass();
    }
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
  };

  const correctCount = quiz.filter(q => answers[q.id] === q.correctAnswer).length;
  const scorePercentage = Math.round((correctCount / quiz.length) * 100);
  const passed = scorePercentage >= requiredScore;

  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-amber-500/5 to-transparent rounded-xl border border-amber-500/20">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2">
          <HelpCircle className="text-amber-500" size={20} />
          {t("lvlAssessment")}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-bold">
            {t("passLabel", { required: requiredScore })}
          </Badge>
          {showResults && (
            <Badge className={cn(
              "font-bold",
              passed ? "bg-emerald-500" : "bg-rose-500"
            )}>
              {scorePercentage}% — {passed ? t("passed") : t("failed")}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {quiz.map((q, qi) => {
          const userAnswer = answers[q.id];
          const isAnswered = userAnswer !== undefined;
          const isCorrect = userAnswer === q.correctAnswer;

          return (
            <div key={q.id} className="space-y-3">
              <p className="font-bold text-foreground text-sm">
                <span className="text-muted-foreground mr-2">{qi + 1}.</span>
                {q.question}
              </p>
              <div className="grid gap-2">
                {q.options.map((option, oi) => (
                  <button
                    key={oi}
                    onClick={() => handleAnswer(q.id, oi)}
                    disabled={showResults}
                    className={cn(
                      "text-left p-3 rounded-lg border text-sm transition-all",
                      showResults
                        ? oi === q.correctAnswer
                          ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                          : oi === userAnswer
                            ? "border-rose-500/50 bg-rose-500/10 text-foreground"
                            : "border-border/30 text-muted-foreground"
                        : userAnswer === oi
                          ? "border-blue-500/50 bg-blue-500/10 text-foreground"
                          : "border-border hover-elevate text-foreground"
                    )}
                    data-testid={`quiz-option-${q.id}-${oi}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border",
                        showResults
                          ? oi === q.correctAnswer
                            ? "border-emerald-500 text-emerald-500"
                            : oi === userAnswer
                              ? "border-rose-500 text-rose-500"
                              : "border-border text-muted-foreground"
                          : userAnswer === oi
                            ? "border-blue-500 text-blue-500 bg-blue-500/10"
                            : "border-border text-muted-foreground"
                      )}>
                        {showResults && oi === q.correctAnswer ? (
                          <CircleCheck size={14} />
                        ) : showResults && oi === userAnswer ? (
                          <XCircle size={14} />
                        ) : (
                          String.fromCharCode(65 + oi)
                        )}
                      </span>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
              </div>
              {showResults && (
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  isCorrect ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-amber-500/5 border border-amber-500/20"
                )}>
                  <div className="flex items-start gap-2">
                    <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">{q.explanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        {!showResults ? (
          <Button
            onClick={checkAnswers}
            disabled={Object.keys(answers).length < quiz.length}
            className="font-bold gap-2"
            data-testid="button-check-answers"
          >
            <Sparkles size={14} />
            {t("submitAssessment")}
          </Button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={resetQuiz} variant="outline" className="font-bold" data-testid="button-retry-quiz">
              {t("tryAgain")}
            </Button>
            {passed && (
              <p className="text-sm text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle size={14} />
                {t("nextLessonUnlocked")}
              </p>
            )}
            {!passed && (
              <p className="text-sm text-muted-foreground">
                {t("needToUnlock", { required: requiredScore })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AITutorSection({ lesson, hasProAccess }: { lesson: Lesson; hasProAccess: boolean }) {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const [question, setQuestion] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const askTutorMutation = useMutation({
    mutationFn: async (q: string) => {
      const lessonContent = lesson.sections.map(s => `${s.title}: ${s.content}`).join('\n\n').slice(0, 3000);
      const response = await apiRequest("POST", "/api/education/ai-tutor", {
        question: q,
        lessonTitle: lesson.title,
        lessonContent
      });
      return await response.json() as { answer: string };
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    askTutorMutation.mutate(question);
  };

  if (!hasProAccess) {
    return (
      <div className="mt-10 p-6 bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-purple-500" size={20} />
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">{t("aiTutor")}</h2>
          </div>
          <Badge variant="outline" className="text-[10px] font-black gap-1">
            <Crown size={10} className="text-amber-500" />
            {t("proElite")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {t("aiTutorUpgrade")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 p-6 bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl border border-purple-500/20">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between"
        data-testid="button-toggle-ai-tutor"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="text-purple-500" size={20} />
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight">{t("aiTutor")}</h2>
        </div>
        <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("aiTutorIntro")}
          </p>

          <div className="flex gap-2">
            <Input
              placeholder={t("aiTutorPlaceholder")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={askTutorMutation.isPending}
              data-testid="input-ai-question"
            />
            <Button
              onClick={handleSubmit}
              disabled={askTutorMutation.isPending || !question.trim()}
              data-testid="button-ask-ai"
            >
              {askTutorMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>

          {askTutorMutation.isSuccess && askTutorMutation.data && (
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2 text-purple-500 text-xs font-black tracking-widest uppercase mb-2">
                <Brain size={14} />
                <span>{t("aiResponse")}</span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {askTutorMutation.data.answer.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="text-sm text-foreground mb-2">{paragraph}</p>
                ))}
              </div>
            </div>
          )}

          {askTutorMutation.isError && (
            <div className="p-4 bg-rose-500/10 rounded-lg border border-rose-500/20">
              <p className="text-sm text-rose-500">{t("aiTutorError")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LessonViewer({
  lesson,
  onClose,
  onSelectLesson,
  userTier,
  isCompleted,
  isBookmarked,
  onMarkComplete,
  onToggleBookmark,
  quizScore,
  nextLesson,
}: {
  lesson: Lesson;
  onClose: () => void;
  onSelectLesson: (id: number) => void;
  userTier: AccessTier;
  isCompleted: boolean;
  isBookmarked: boolean;
  onMarkComplete: (lessonId: number, completed: boolean) => void;
  onToggleBookmark: (lessonId: number) => void;
  quizScore: number;
  nextLesson: Lesson | null;
}) {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const hasProAccess = userTier === "PRO" || userTier === "ELITE";

  const phase = EDUCATION_PHASES.find(p => p.id === lesson.phaseId);
  const colors = phaseColorMap[phase?.color || "slate"] || phaseColorMap.slate;

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [lesson.id]);

  const quizPassed = quizScore >= lesson.requiredScore;

  return (
    <div className="pb-20 md:pb-0" ref={topRef}>
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 sm:px-6 lg:px-10 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-bold gap-2"
            data-testid="button-back-to-lessons"
          >
            <ArrowLeft size={16} />
            {t("backToPhases")}
          </Button>
          <div className="flex items-center gap-2">
            {phase && (
              <Badge variant="outline" className={cn("text-[10px] font-bold", colors.text)}>
                {t("phaseLabelFull", { id: phase.id, title: phase.title })}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleBookmark(lesson.id)}
              className="font-bold gap-2"
              data-testid="button-toggle-bookmark"
            >
              {isBookmarked ? (
                <>
                  <BookmarkCheck size={14} className="text-amber-500" />
                  {t("bookmarked")}
                </>
              ) : (
                <>
                  <Bookmark size={14} />
                  {t("bookmark")}
                </>
              )}
            </Button>
            <Badge variant="outline" className={cn(
              "text-[10px] font-bold",
              lesson.difficulty === "Beginner"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : lesson.difficulty === "Intermediate"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-500 border-rose-500/20"
            )}>
              {lesson.difficulty === "Beginner" ? t("difficultyBeginner") : lesson.difficulty === "Intermediate" ? t("difficultyIntermediate") : t("difficultyAdvanced")}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-10">
        <div className="max-w-4xl mx-auto py-8">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <span>{t("lessonNumber", { phase: lesson.phaseId, order: lesson.order })}</span>
              <span className="text-border">|</span>
              <Clock size={12} />
              <span>{lesson.duration}</span>
              <span className="text-border">|</span>
              <BookOpen size={12} />
              <span>{t("sections", { count: lesson.sections.length })}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mb-3" data-testid="text-lesson-heading">
              {lesson.title}
            </h1>
            <p className="text-muted-foreground text-base italic">{lesson.description}</p>
          </div>

          {lesson.sections.map((section, idx) => (
            <div key={idx} className="mb-10">
              <h2 className="text-lg font-black text-foreground mb-4 tracking-tight flex items-center gap-2">
                <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", colors.bg, colors.text)}>
                  {idx + 1}
                </span>
                {section.title}
              </h2>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                {section.content.split('\n\n').map((paragraph, pidx) => (
                  <p key={pidx} className="text-foreground/90 mb-4 leading-relaxed text-sm">
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet, bidx) => (
                    <li key={bidx} className="flex items-start gap-2 text-sm text-foreground/80">
                      <ChevronRight size={14} className={cn("mt-0.5 shrink-0", colors.text)} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.tradingExample && (
                <div className="mt-6 p-4 bg-card rounded-lg border border-border">
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Target size={12} />
                    {t("tradingExample")}
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-bold text-foreground">{t("setupLabel")} </span>
                      <span className="text-foreground/80">{section.tradingExample.setup}</span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">{t("entryLabel")} </span>
                      <span className="text-foreground/80">{section.tradingExample.entry}</span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">{t("managementLabel")} </span>
                      <span className="text-foreground/80">{section.tradingExample.management}</span>
                    </div>
                    <div>
                      <span className="font-bold text-foreground">{t("outcomeLabel")} </span>
                      <span className="text-foreground/80">{section.tradingExample.outcome}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {lesson.diagrams && lesson.diagrams.length > 0 && (
            <div className="mt-8 space-y-6">
              {lesson.diagrams.map((diagramType) => {
                const DiagramComponent = DIAGRAM_TYPES[diagramType];
                if (!DiagramComponent) return null;
                const label = diagramType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                return (
                  <div key={diagramType} className="p-4 bg-card rounded-lg border border-border">
                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                      <TrendingUp size={12} />
                      {label}
                    </h3>
                    <DiagramComponent />
                  </div>
                );
              })}
            </div>
          )}

          {lesson.keyPoints && lesson.keyPoints.length > 0 && (
            <div className="mt-10 p-6 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                <Lightbulb className="text-emerald-500" size={20} />
                {t("keyTakeaways")}
              </h2>
              <ul className="space-y-2">
                {lesson.keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lesson.commonMistakes && lesson.commonMistakes.length > 0 && (
            <div className="mt-6 p-6 bg-rose-500/5 rounded-xl border border-rose-500/20">
              <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={20} />
                {t("commonMistakes")}
              </h2>
              <ul className="space-y-2">
                {lesson.commonMistakes.map((mistake, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                    <XCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AITutorSection lesson={lesson} hasProAccess={hasProAccess} />

          {lesson.quiz && lesson.quiz.length > 0 && (
            <QuizSection
              key={lesson.id}
              quiz={lesson.quiz}
              lessonId={lesson.id}
              requiredScore={lesson.requiredScore}
              onQuizPass={() => {
                if (!isCompleted) {
                  onMarkComplete(lesson.id, true);
                }
              }}
            />
          )}

          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col items-center gap-4">
              <Button
                variant={isCompleted ? "outline" : "default"}
                onClick={() => onMarkComplete(lesson.id, !isCompleted)}
                className={cn(
                  "font-bold gap-2 px-8",
                  isCompleted && "border-emerald-500/50"
                )}
                data-testid="button-mark-complete"
              >
                {isCompleted ? (
                  <>
                    <CheckCircle size={16} className="text-emerald-500" />
                    {t("lessonCompleted")}
                  </>
                ) : (
                  <>
                    <CircleCheck size={16} />
                    {t("markComplete")}
                  </>
                )}
              </Button>

              {isCompleted && nextLesson && (
                <Button
                  onClick={() => onSelectLesson(nextLesson.id)}
                  className="font-bold gap-2"
                  data-testid="button-next-lesson"
                >
                  {t("nextButtonLabel", { title: nextLesson.title })}
                  <ChevronRight size={16} />
                </Button>
              )}

              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">
                {t("notFinancialAdvice")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 md:bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-all"
          data-testid="button-scroll-to-top"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}

export default function KnowledgeBase() {
  const { t } = useTranslation("common", { keyPrefix: "kb" });
  const { tier, isPaid, isElite } = usePlan();
  const [, navigate] = useLocation();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([0]));

  const userTier: AccessTier = (tier as AccessTier) || "FREE";

  const { data: progress = [] } = useQuery<LessonProgress[]>({
    queryKey: ["/api/education/progress"],
  });

  const { data: bookmarks = [] } = useQuery<LessonBookmark[]>({
    queryKey: ["/api/education/bookmarks"],
  });

  const { data: quizResults = [] } = useQuery<QuizResult[]>({
    queryKey: ["/api/education/quiz-results"],
  });

  const progressMutation = useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: number; completed: boolean }) => {
      return apiRequest("POST", "/api/education/progress", { lessonId, completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/progress"] });
    },
  });

  const addBookmarkMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest("POST", "/api/education/bookmarks", { lessonId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/bookmarks"] });
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest("DELETE", `/api/education/bookmarks/${lessonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/bookmarks"] });
    },
  });

  const completedLessonIds = useMemo(() => {
    return new Set(progress.filter(p => p.completed).map(p => p.lessonId));
  }, [progress]);

  const bookmarkedLessonIds = useMemo(() => {
    return new Set(bookmarks.map(b => b.lessonId));
  }, [bookmarks]);

  const quizScores = useMemo(() => {
    const scores = new Map<number, number>();
    quizResults.forEach(result => {
      const percentage = Math.round((result.score / result.totalQuestions) * 100);
      const existing = scores.get(result.lessonId) ?? 0;
      if (percentage > existing) {
        scores.set(result.lessonId, percentage);
      }
    });
    return scores;
  }, [quizResults]);

  const handleToggleBookmark = (lessonId: number) => {
    if (bookmarkedLessonIds.has(lessonId)) {
      removeBookmarkMutation.mutate(lessonId);
    } else {
      addBookmarkMutation.mutate(lessonId);
    }
  };

  const handleMarkComplete = (lessonId: number, completed: boolean) => {
    progressMutation.mutate({ lessonId, completed });
  };

  const togglePhase = (phaseId: number) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const phaseLessonsMap = useMemo(() => {
    const map = new Map<number, Lesson[]>();
    EDUCATION_PHASES.forEach(p => {
      map.set(p.id, EDUCATION_LESSONS.filter(l => l.phaseId === p.id).sort((a, b) => a.order - b.order));
    });
    return map;
  }, []);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    return EDUCATION_LESSONS.find((l) => l.id === selectedLessonId) || null;
  }, [selectedLessonId]);

  const nextLessonForSelected = useMemo(() => {
    if (!selectedLesson) return null;
    const nextInPhase = EDUCATION_LESSONS.find(
      l => l.phaseId === selectedLesson.phaseId && l.order === selectedLesson.order + 1
    );
    if (nextInPhase) return nextInPhase;
    const nextPhase = EDUCATION_PHASES.find(p => p.id === selectedLesson.phaseId + 1);
    if (nextPhase) {
      return EDUCATION_LESSONS.find(l => l.phaseId === nextPhase.id && l.order === 1) || null;
    }
    return null;
  }, [selectedLesson]);

  const totalLessons = EDUCATION_LESSONS.length;
  const completedCount = completedLessonIds.size;
  const overallPercentage = Math.round((completedCount / totalLessons) * 100);

  const currentPhase = useMemo(() => {
    for (let i = EDUCATION_PHASES.length - 1; i >= 0; i--) {
      const phase = EDUCATION_PHASES[i];
      const phaseLessons = phaseLessonsMap.get(phase.id) || [];
      if (phaseLessons.some(l => completedLessonIds.has(l.id))) {
        const allDone = phaseLessons.every(l => completedLessonIds.has(l.id));
        if (allDone && i < EDUCATION_PHASES.length - 1) return EDUCATION_PHASES[i + 1];
        return phase;
      }
    }
    return EDUCATION_PHASES[0];
  }, [completedLessonIds, phaseLessonsMap]);

  useEffect(() => {
    if (currentPhase && !expandedPhases.has(currentPhase.id)) {
      setExpandedPhases(prev => new Set([...prev, currentPhase.id]));
    }
  }, [currentPhase]);

  if (selectedLesson) {
    return (
      <div className="flex-1 text-foreground bg-background min-h-screen">
        <LessonViewer
          lesson={selectedLesson}
          onClose={() => setSelectedLessonId(null)}
          onSelectLesson={setSelectedLessonId}
          userTier={userTier}
          isCompleted={completedLessonIds.has(selectedLesson.id)}
          isBookmarked={bookmarkedLessonIds.has(selectedLesson.id)}
          onMarkComplete={handleMarkComplete}
          onToggleBookmark={handleToggleBookmark}
          quizScore={quizScores.get(selectedLesson.id) ?? 0}
          nextLesson={nextLessonForSelected}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background min-h-screen">
      <main className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="text-emerald-500" size={28} />
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight uppercase italic">
                {t("educationHub")}
              </h1>
            </div>
            {isElite ? (
              <Badge className="bg-gradient-to-r from-purple-500 to-violet-500 text-white font-bold gap-1">
                <Star size={12} />
                {t("eliteAccess")}
              </Badge>
            ) : isPaid ? (
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold gap-1">
                <Star size={12} />
                {t("proAccess")}
              </Badge>
            ) : (
              <Button
                size="sm"
                className="font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500"
                onClick={() => navigate("/profile")}
                data-testid="button-upgrade-for-access"
              >
                <Crown size={14} />
                {t("upgradeForAccess")}
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1 italic font-medium max-w-2xl">
            {t("masterTradingThrough", { count: EDUCATION_PHASES.length })}
          </p>

          <div className="mt-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{t("overallProgress")}</span>
                {currentPhase && (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {t("phaseLabelShort", { id: currentPhase.id, title: currentPhase.title })}
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{t("lessonsCount", { completed: completedCount, total: totalLessons })}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
                data-testid="progress-bar"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-muted-foreground">{t("percentComplete", { percentage: overallPercentage })}</p>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <CheckCircle size={10} />
                  {t("countCompleted", { count: completedCount })}
                </span>
                <span className="text-muted-foreground">
                  {t("countRemaining", { count: totalLessons - completedCount })}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-3 border-l-2 border-amber-500/50 pl-2">
            {t("notFinancialAdvice")}{" "}
            <Link
              to="/risk-disclaimer"
              className="ml-1 text-emerald-500/70 hover:underline"
            >
              {t("viewRiskDisclaimer")}
            </Link>
          </p>
        </header>

        <div className="space-y-6">
          {EDUCATION_PHASES.map((phase) => {
            const lessons = phaseLessonsMap.get(phase.id) || [];
            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                lessons={lessons}
                completedLessons={completedLessonIds}
                quizScores={quizScores}
                userTier={userTier}
                onSelectLesson={(id) => setSelectedLessonId(id)}
                isExpanded={expandedPhases.has(phase.id)}
                onToggleExpand={() => togglePhase(phase.id)}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}
