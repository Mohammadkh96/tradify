import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, TrendingUp, Brain, Target, Heart, Zap,
  Lock, Clock, ChevronRight, Crown, Star,
  GraduationCap, CheckCircle, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePlan } from "@/hooks/usePlan";
import {
  EDUCATION_LESSONS,
  LESSON_CATEGORIES,
  type Lesson,
  type LessonCategory,
  canAccessLesson,
} from "@/data/educationLessons";

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
}: {
  lesson: Lesson;
  hasFullAccess: boolean;
  onSelectLesson: (id: number) => void;
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
            : "opacity-75"
        )}
        onClick={() => canAccess && onSelectLesson(lesson.id)}
        data-testid={`lesson-card-${lesson.id}`}
      >
        {lesson.isFree && (
          <div className="absolute top-3 right-3">
            <Badge className="bg-emerald-500 text-white text-[10px] font-black">
              FREE
            </Badge>
          </div>
        )}
        {!canAccess && (
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="text-[10px] font-black gap-1">
              <Lock size={10} />
              PRO
            </Badge>
          </div>
        )}

        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "p-3 rounded-lg shrink-0",
                lesson.isFree
                  ? "bg-emerald-500/10"
                  : "bg-muted"
              )}
            >
              <CategoryIcon
                className={cn(
                  "w-5 h-5",
                  lesson.isFree ? "text-emerald-500" : "text-muted-foreground"
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

function LessonViewer({
  lesson,
  onClose,
}: {
  lesson: Lesson;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-10">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-bold gap-2"
            data-testid="button-back-to-lessons"
          >
            <ArrowLeft size={16} />
            Back to Lessons
          </Button>
          <Badge
            variant="outline"
            className={cn("font-bold", difficultyColors[lesson.difficulty])}
          >
            {lesson.difficulty}
          </Badge>
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

            <div className="space-y-8">
              {lesson.sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className="border-l-2 border-emerald-500/30 pl-6" data-testid={`section-${sectionIdx}`}>
                  <h3 className="text-xl font-black text-foreground mb-4" data-testid={`text-section-title-${sectionIdx}`}>
                    {section.title}
                  </h3>
                  <ul className="space-y-3">
                    {section.content.map((item, itemIdx) => (
                      <li
                        key={itemIdx}
                        className="flex items-start gap-3 text-muted-foreground"
                        data-testid={`section-${sectionIdx}-item-${itemIdx}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                        <span className="text-sm leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

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

  const hasFullAccess = canAccess("fullEducationAccess");

  const lessonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    EDUCATION_LESSONS.forEach((lesson) => {
      counts[lesson.category] = (counts[lesson.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filteredLessons = useMemo(() => {
    if (!selectedCategory) return EDUCATION_LESSONS;
    return EDUCATION_LESSONS.filter((l) => l.category === selectedCategory);
  }, [selectedCategory]);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId) return null;
    return EDUCATION_LESSONS.find((l) => l.id === selectedLessonId) || null;
  }, [selectedLessonId]);

  const freeLessonsCount = EDUCATION_LESSONS.filter((l) => l.isFree).length;
  const paidLessonsCount = EDUCATION_LESSONS.filter((l) => !l.isFree).length;

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
            covering price action, smart money concepts, and advanced strategies.
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className="text-emerald-500 font-bold">
              {freeLessonsCount} Free Lessons
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {paidLessonsCount} Pro Lessons
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
            />
          ))}
        </div>

        {filteredLessons.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              No lessons found in this category.
            </p>
          </div>
        )}

        <AnimatePresence>
          {selectedLesson && (
            <LessonViewer
              lesson={selectedLesson}
              onClose={() => setSelectedLessonId(null)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
