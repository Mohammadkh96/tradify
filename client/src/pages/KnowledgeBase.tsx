import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, TrendingUp, Brain, Target, Heart, Zap,
  Lock, Clock, ChevronRight, Crown, Star, Search,
  GraduationCap, CheckCircle, ArrowLeft, AlertTriangle,
  Lightbulb, Play, XCircle, CircleCheck, Link2, HelpCircle,
  Bookmark, BookmarkCheck, MessageSquare, Send, Loader2
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
  LESSON_CATEGORIES,
  type Lesson,
  type LessonCategory,
  type QuizQuestion,
  type DiagramType,
  canAccessLesson,
} from "@/data/educationLessons";
import { DIAGRAM_TYPES } from "@/components/TradingDiagrams";

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

const categoryIcons: Record<string, typeof BookOpen> = {
  fundamentals: BookOpen,
  "price-action": TrendingUp,
  "smart-money": Brain,
  strategies: Target,
  psychology: Heart,
  advanced: Zap,
};

const difficultyColors: Record<string, string> = {
  Beginner: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Intermediate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Advanced: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

function LessonCard({
  lesson,
  hasFullAccess,
  onSelectLesson,
  isCompleted,
  isBookmarked,
  onToggleBookmark,
}: {
  lesson: Lesson;
  hasFullAccess: boolean;
  onSelectLesson: (id: number) => void;
  isCompleted: boolean;
  isBookmarked: boolean;
  onToggleBookmark: (lessonId: number) => void;
}) {
  const canAccess = canAccessLesson(lesson.id, hasFullAccess);
  const CategoryIcon = categoryIcons[lesson.category] || BookOpen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "relative overflow-visible transition-all duration-200 h-full",
          canAccess
            ? "hover:border-emerald-500/50 cursor-pointer hover-elevate"
            : "opacity-75",
          isCompleted && "border-emerald-500/30"
        )}
        onClick={() => canAccess && onSelectLesson(lesson.id)}
        data-testid={`lesson-card-${lesson.id}`}
      >
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {isCompleted && (
            <CheckCircle className="w-5 h-5 text-emerald-500" data-testid={`completed-${lesson.id}`} />
          )}
          {canAccess && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleBookmark(lesson.id);
              }}
              className="p-1 hover:bg-muted rounded"
              data-testid={`bookmark-toggle-${lesson.id}`}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-4 h-4 text-amber-500" />
              ) : (
                <Bookmark className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
          {lesson.isFree && !isCompleted && (
            <Badge className="bg-emerald-500 text-white text-[10px] font-black">
              FREE
            </Badge>
          )}
          {!canAccess && (
            <Badge variant="outline" className="text-[10px] font-black gap-1">
              <Lock size={10} />
              PRO
            </Badge>
          )}
        </div>

        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-3 rounded-lg shrink-0",
                isCompleted
                  ? "bg-emerald-500/10"
                  : lesson.isFree
                    ? "bg-emerald-500/10"
                    : "bg-muted"
              )}
            >
              <CategoryIcon
                className={cn(
                  "w-5 h-5",
                  isCompleted ? "text-emerald-500" : lesson.isFree ? "text-emerald-500" : "text-muted-foreground"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-sm sm:text-base mb-1 line-clamp-2" data-testid={`text-card-title-${lesson.id}`}>
                {lesson.title}
              </h3>
              <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2 mb-3" data-testid={`text-card-description-${lesson.id}`}>
                {lesson.description}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] font-bold", difficultyColors[lesson.difficulty])}
                >
                  {lesson.difficulty}
                </Badge>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Clock size={12} />
                  <span>{lesson.duration}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <BookOpen size={12} />
                  <span>{lesson.sections.length} sections</span>
                </div>
                {lesson.quiz && lesson.quiz.length > 0 && (
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <HelpCircle size={12} />
                    <span>Quiz</span>
                  </div>
                )}
              </div>
            </div>

            {canAccess && (
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 hidden sm:block" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  lessonCounts,
}: {
  categories: LessonCategory[];
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  lessonCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Button
        variant={selectedCategory === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelectCategory(null)}
        className="font-bold"
        data-testid="filter-all"
      >
        All Lessons
        <Badge variant="secondary" className="ml-2 text-[10px]">
          {EDUCATION_LESSONS.length}
        </Badge>
      </Button>
      {categories.map((cat) => {
        const Icon = categoryIcons[cat.id] || BookOpen;
        return (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectCategory(cat.id)}
            className="font-bold gap-2"
            data-testid={`filter-${cat.id}`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{cat.name}</span>
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {lessonCounts[cat.id] || 0}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}

function QuizSection({ quiz, lessonId }: { quiz: QuizQuestion[]; lessonId: number }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  const saveQuizResultMutation = useMutation({
    mutationFn: async (data: { score: number; totalQuestions: number; answers: Record<number, number> }) => {
      return apiRequest("/api/education/quiz-results", {
        method: "POST",
        body: JSON.stringify({ lessonId, ...data }),
      });
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
    saveQuizResultMutation.mutate({
      score,
      totalQuestions: quiz.length,
      answers,
    });
  };

  const resetQuiz = () => {
    setAnswers({});
    setShowResults(false);
  };

  const correctCount = quiz.filter(q => answers[q.id] === q.correctAnswer).length;

  return (
    <div className="mt-8 p-6 bg-gradient-to-r from-amber-500/5 to-transparent rounded-xl border border-amber-500/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-foreground uppercase tracking-tight flex items-center gap-2">
          <HelpCircle className="text-amber-500" size={20} />
          Knowledge Check
        </h2>
        {showResults && (
          <Badge className={cn(
            "font-bold",
            correctCount === quiz.length ? "bg-emerald-500" : correctCount >= quiz.length / 2 ? "bg-amber-500" : "bg-rose-500"
          )}>
            {correctCount}/{quiz.length} Correct
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        {quiz.map((question, qIdx) => {
          const userAnswer = answers[question.id];
          const isCorrect = userAnswer === question.correctAnswer;
          const showAnswer = showResults && userAnswer !== undefined;

          return (
            <div key={question.id} className="space-y-3" data-testid={`quiz-question-${lessonId}-${qIdx}`}>
              <p className="font-bold text-foreground">
                {qIdx + 1}. {question.question}
              </p>
              <div className="grid gap-2">
                {question.options.map((option, oIdx) => {
                  const isSelected = userAnswer === oIdx;
                  const isCorrectAnswer = question.correctAnswer === oIdx;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => handleAnswer(question.id, oIdx)}
                      disabled={showResults}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-all text-sm",
                        !showResults && "hover:border-amber-500/50",
                        isSelected && !showResults && "border-amber-500 bg-amber-500/10",
                        showResults && isCorrectAnswer && "border-emerald-500 bg-emerald-500/10",
                        showResults && isSelected && !isCorrect && "border-rose-500 bg-rose-500/10",
                        !isSelected && !showResults && "border-border"
                      )}
                      data-testid={`quiz-option-${lessonId}-${qIdx}-${oIdx}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          isSelected && !showResults && "bg-amber-500 text-white",
                          showResults && isCorrectAnswer && "bg-emerald-500 text-white",
                          showResults && isSelected && !isCorrect && "bg-rose-500 text-white",
                          !isSelected && "bg-muted text-muted-foreground"
                        )}>
                          {showResults && isCorrectAnswer ? (
                            <CheckCircle size={14} />
                          ) : showResults && isSelected && !isCorrect ? (
                            <XCircle size={14} />
                          ) : (
                            String.fromCharCode(65 + oIdx)
                          )}
                        </div>
                        <span className={cn(
                          showResults && isCorrectAnswer && "text-emerald-500 font-medium",
                          showResults && isSelected && !isCorrect && "text-rose-500"
                        )}>
                          {option}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {showAnswer && (
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  isCorrect ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"
                )}>
                  <p className={cn("font-medium", isCorrect ? "text-emerald-500" : "text-rose-500")}>
                    {isCorrect ? "Correct!" : "Incorrect"}
                  </p>
                  <p className="text-muted-foreground mt-1">{question.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        {!showResults ? (
          <Button 
            onClick={checkAnswers} 
            disabled={Object.keys(answers).length !== quiz.length}
            className="font-bold"
            data-testid="button-check-answers"
          >
            Check Answers
          </Button>
        ) : (
          <Button onClick={resetQuiz} variant="outline" className="font-bold" data-testid="button-retry-quiz">
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}

function AITutorSection({ lesson, hasFullAccess }: { lesson: Lesson; hasFullAccess: boolean }) {
  const [question, setQuestion] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const askTutorMutation = useMutation({
    mutationFn: async (q: string) => {
      const lessonContent = lesson.sections.map(s => `${s.title}: ${s.content}`).join('\n\n').slice(0, 3000);
      const response = await apiRequest("/api/education/ai-tutor", {
        method: "POST",
        body: JSON.stringify({ 
          question: q, 
          lessonTitle: lesson.title,
          lessonContent 
        }),
      });
      return response as { answer: string };
    },
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    askTutorMutation.mutate(question);
  };

  if (!hasFullAccess) {
    return (
      <div className="mt-10 p-6 bg-gradient-to-r from-purple-500/5 to-transparent rounded-xl border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-purple-500" size={20} />
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">AI Tutor</h2>
          </div>
          <Badge variant="outline" className="text-[10px] font-black gap-1">
            <Crown size={10} className="text-amber-500" />
            PRO/ELITE
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Upgrade to Pro or Elite to ask questions about this lesson and get personalized explanations.
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
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight">AI Tutor</h2>
        </div>
        <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
      </button>
      
      {isOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ask any question about this lesson and get a personalized explanation based on the content.
          </p>
          
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Can you explain order blocks in simpler terms?"
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
                <span>AI Response</span>
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
              <p className="text-sm text-rose-500">Failed to get response. Please try again.</p>
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
  hasFullAccess,
  isCompleted,
  isBookmarked,
  onMarkComplete,
  onToggleBookmark,
}: {
  lesson: Lesson;
  onClose: () => void;
  onSelectLesson: (id: number) => void;
  hasFullAccess: boolean;
  isCompleted: boolean;
  isBookmarked: boolean;
  onMarkComplete: (lessonId: number, completed: boolean) => void;
  onToggleBookmark: (lessonId: number) => void;
}) {
  const relatedLessonObjects = useMemo(() => {
    return lesson.relatedLessons
      .map(id => EDUCATION_LESSONS.find(l => l.id === id))
      .filter((l): l is Lesson => l !== undefined);
  }, [lesson.relatedLessons]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-bold gap-2"
            data-testid="button-back-to-lessons"
          >
            <ArrowLeft size={16} />
            Back to Lessons
          </Button>
          <div className="flex items-center gap-2">
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
                  Bookmarked
                </>
              ) : (
                <>
                  <Bookmark size={14} />
                  Bookmark
                </>
              )}
            </Button>
            <Button
              variant={isCompleted ? "outline" : "default"}
              size="sm"
              onClick={() => onMarkComplete(lesson.id, !isCompleted)}
              className={cn("font-bold gap-2", isCompleted && "border-emerald-500/50")}
              data-testid="button-mark-complete"
            >
              {isCompleted ? (
                <>
                  <CheckCircle size={14} className="text-emerald-500" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircle size={14} />
                  Mark Complete
                </>
              )}
            </Button>
            <Badge
              variant="outline"
              className={cn("font-bold", difficultyColors[lesson.difficulty])}
            >
              {lesson.difficulty}
            </Badge>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`lesson-viewer-${lesson.id}`}>
          <div className="p-6 sm:p-8 border-b border-border bg-gradient-to-r from-emerald-500/5 to-transparent">
            <div className="flex items-center gap-2 text-emerald-500 text-xs font-black tracking-widest uppercase mb-2">
              <GraduationCap size={14} />
              <span data-testid="text-lesson-number">Lesson {lesson.id}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-3" data-testid="text-lesson-title">
              {lesson.title}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl" data-testid="text-lesson-description">
              {lesson.description}
            </p>
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{lesson.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen size={14} />
                <span>{lesson.sections.length} sections</span>
              </div>
              {lesson.quiz && lesson.quiz.length > 0 && (
                <div className="flex items-center gap-1">
                  <HelpCircle size={14} />
                  <span>{lesson.quiz.length} quiz questions</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-8">
              <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                <CheckCircle className="text-emerald-500" size={18} />
                Key Takeaways
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lesson.keyPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20"
                    data-testid={`keypoint-${idx}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-emerald-500 text-xs font-black">
                        {idx + 1}
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium" data-testid={`text-keypoint-${idx}`}>{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-10">
              {lesson.sections.map((section, sectionIdx) => (
                <div key={sectionIdx} data-testid={`section-${sectionIdx}`}>
                  <h3 className="text-xl font-black text-foreground mb-4 flex items-center gap-2" data-testid={`text-section-title-${sectionIdx}`}>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <span className="text-emerald-500 text-sm font-black">{sectionIdx + 1}</span>
                    </div>
                    {section.title}
                  </h3>
                  
                  {section.content && (
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4">
                      {section.content.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx} className="text-muted-foreground leading-relaxed mb-4">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-2 mb-4">
                      {section.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-3 text-muted-foreground">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span className="text-sm leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.tradingExample && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/5 to-transparent rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 text-blue-500 text-xs font-black tracking-widest uppercase mb-3">
                        <Play size={14} />
                        <span>Trading Example</span>
                      </div>
                      <div className="grid gap-3">
                        <div>
                          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Setup</p>
                          <p className="text-sm text-muted-foreground">{section.tradingExample.setup}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Entry</p>
                          <p className="text-sm text-muted-foreground">{section.tradingExample.entry}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-400 uppercase mb-1">Management</p>
                          <p className="text-sm text-muted-foreground">{section.tradingExample.management}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-400 uppercase mb-1">Outcome</p>
                          <p className="text-sm text-foreground font-medium">{section.tradingExample.outcome}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {lesson.diagrams && lesson.diagrams.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                  <TrendingUp className="text-cyan-500" size={18} />
                  Visual Reference
                </h2>
                <div className="grid gap-6">
                  {lesson.diagrams.map((diagramType: DiagramType) => {
                    const DiagramComponent = DIAGRAM_TYPES[diagramType];
                    return DiagramComponent ? <DiagramComponent key={diagramType} /> : null;
                  })}
                </div>
              </div>
            )}

            {lesson.commonMistakes && lesson.commonMistakes.length > 0 && (
              <div className="mt-10 p-6 bg-rose-500/5 rounded-xl border border-rose-500/20">
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={18} />
                  Common Mistakes to Avoid
                </h2>
                <ul className="space-y-3">
                  {lesson.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lesson.quiz && lesson.quiz.length > 0 && (
              <QuizSection quiz={lesson.quiz} lessonId={lesson.id} />
            )}

            <AITutorSection lesson={lesson} hasFullAccess={hasFullAccess} />

            {lesson.relatedLessons && relatedLessonObjects.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-4 flex items-center gap-2">
                  <Link2 className="text-emerald-500" size={18} />
                  Related Lessons
                </h2>
                <div className="grid gap-3">
                  {relatedLessonObjects.map((related) => {
                    const canAccess = canAccessLesson(related.id, hasFullAccess);
                    return (
                      <button
                        key={related.id}
                        onClick={() => canAccess && onSelectLesson(related.id)}
                        disabled={!canAccess}
                        className={cn(
                          "text-left p-4 rounded-lg border transition-all flex items-center justify-between gap-4",
                          canAccess ? "hover:border-emerald-500/50 hover-elevate" : "opacity-60"
                        )}
                        data-testid={`related-lesson-${related.id}`}
                      >
                        <div>
                          <p className="font-bold text-foreground text-sm">{related.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{related.description.slice(0, 80)}...</p>
                        </div>
                        {canAccess ? (
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        ) : (
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest text-center">
                Educational content only. Not financial advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function KnowledgeBase() {
  const { canAccess } = usePlan();
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBookmarked, setShowBookmarked] = useState(false);

  const hasFullAccess = canAccess("fullEducationAccess");

  const { data: progress = [] } = useQuery<LessonProgress[]>({
    queryKey: ["/api/education/progress"],
  });

  const { data: bookmarks = [] } = useQuery<LessonBookmark[]>({
    queryKey: ["/api/education/bookmarks"],
  });

  const progressMutation = useMutation({
    mutationFn: async ({ lessonId, completed }: { lessonId: number; completed: boolean }) => {
      return apiRequest("/api/education/progress", {
        method: "POST",
        body: JSON.stringify({ lessonId, completed }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/progress"] });
    },
  });

  const addBookmarkMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest("/api/education/bookmarks", {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/bookmarks"] });
    },
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest(`/api/education/bookmarks/${lessonId}`, {
        method: "DELETE",
      });
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

  const lessonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    EDUCATION_LESSONS.forEach((lesson) => {
      counts[lesson.category] = (counts[lesson.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredLessons = useMemo(() => {
    let lessons = EDUCATION_LESSONS;
    
    if (showBookmarked) {
      lessons = lessons.filter(l => bookmarkedLessonIds.has(l.id));
    }
    
    if (selectedCategory) {
      lessons = lessons.filter((l) => l.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      lessons = lessons.filter(
        (l) =>
          l.title.toLowerCase().includes(query) ||
          l.description.toLowerCase().includes(query) ||
          l.sections.some((s) => s.title.toLowerCase().includes(query))
      );
    }
    
    return lessons;
  }, [selectedCategory, searchQuery, showBookmarked, bookmarkedLessonIds]);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    return EDUCATION_LESSONS.find((l) => l.id === selectedLessonId) || null;
  }, [selectedLessonId]);

  const freeLessonsCount = EDUCATION_LESSONS.filter((l) => l.isFree).length;
  const paidLessonsCount = EDUCATION_LESSONS.filter((l) => !l.isFree).length;
  const completedCount = completedLessonIds.size;
  const progressPercentage = Math.round((completedCount / EDUCATION_LESSONS.length) * 100);

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background min-h-screen">
      <main className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="text-emerald-500" size={28} />
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight uppercase italic">
                Education Hub
              </h1>
            </div>
            {hasFullAccess ? (
              <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold gap-1">
                <Star size={12} />
                Full Access
              </Badge>
            ) : (
              <Button
                size="sm"
                className="font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-500"
                onClick={() => navigate("/profile")}
                data-testid="button-upgrade-for-access"
              >
                <Crown size={14} />
                Upgrade for Full Access
              </Button>
            )}
          </div>
          <p className="text-muted-foreground mt-1 italic font-medium max-w-2xl">
            Master institutional trading concepts with {EDUCATION_LESSONS.length} comprehensive lessons
            covering price action, smart money concepts, psychology, and advanced strategies.
          </p>
          
          <div className="mt-4 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-foreground">Your Progress</span>
              <span className="text-sm text-muted-foreground">{completedCount} / {EDUCATION_LESSONS.length} lessons</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div 
                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${progressPercentage}%` }}
                data-testid="progress-bar"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{progressPercentage}% complete</p>
          </div>
          
          <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
            <span className="text-emerald-500 font-bold">
              {freeLessonsCount} Free Lessons
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {paidLessonsCount} Pro Lessons
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground flex items-center gap-1">
              <HelpCircle size={12} />
              Quizzes Included
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-3 border-l-2 border-amber-500/50 pl-2">
            Educational content only. Not financial advice.{" "}
            <Link
              to="/risk-disclaimer"
              className="ml-1 text-emerald-500/70 hover:underline"
            >
              View Risk Disclaimer
            </Link>
          </p>
        </header>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Search lessons by title, topic, or concept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 font-medium"
              data-testid="input-search-lessons"
            />
          </div>
          <Button
            variant={showBookmarked ? "default" : "outline"}
            onClick={() => setShowBookmarked(!showBookmarked)}
            className="font-bold gap-2"
            data-testid="button-show-bookmarks"
          >
            <Bookmark size={16} />
            Bookmarked ({bookmarks.length})
          </Button>
        </div>

        <CategoryFilter
          categories={LESSON_CATEGORIES}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          lessonCounts={lessonCounts}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              hasFullAccess={hasFullAccess}
              onSelectLesson={setSelectedLessonId}
              isCompleted={completedLessonIds.has(lesson.id)}
              isBookmarked={bookmarkedLessonIds.has(lesson.id)}
              onToggleBookmark={handleToggleBookmark}
            />
          ))}
        </div>

        {filteredLessons.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {showBookmarked ? "No bookmarked lessons yet." : "No lessons found."}
            </p>
          </div>
        )}

        <AnimatePresence>
          {selectedLesson && (
            <LessonViewer
              lesson={selectedLesson}
              onClose={() => setSelectedLessonId(null)}
              onSelectLesson={setSelectedLessonId}
              hasFullAccess={hasFullAccess}
              isCompleted={completedLessonIds.has(selectedLesson.id)}
              isBookmarked={bookmarkedLessonIds.has(selectedLesson.id)}
              onMarkComplete={handleMarkComplete}
              onToggleBookmark={handleToggleBookmark}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
