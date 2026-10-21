import React, { useState } from 'react';
import { Star, CheckCircle2, Sparkles, Send } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface PostSessionFeedbackProps {
  coachName?: string;
  sessionDate?: string;
  market?: string;
  onSubmitFeedback?: (rating: number, review: string) => Promise<void>;
  className?: string;
  defaultSubmitted?: boolean;
}

export const PostSessionFeedback: React.FC<PostSessionFeedbackProps> = ({
  coachName = 'Your Coach',
  sessionDate = 'Recently',
  market = 'Professional Consultation',
  onSubmitFeedback,
  className,
  defaultSubmitted = false,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [review, setReview] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(defaultSubmitted);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review.trim() && rating === 0) return;
    setLoading(true);
    try {
      if (onSubmitFeedback) {
        await onSubmitFeedback(rating, review);
      }
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("bg-card border border-border rounded-xl p-6 shadow-sm text-foreground space-y-5", className)}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold tracking-tight">Post-Session Review</h3>
            <Badge variant={submitted ? "success" : "secondary"} className="text-[10px] uppercase tracking-wider">
              {submitted ? "Feedback Recorded" : "Pending Review"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Session with <span className="font-medium text-foreground">{coachName}</span> &middot; {market} &middot; {sessionDate}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-primary/5 text-primary border border-primary/10">
          <Sparkles className="w-5 h-5" />
        </div>
      </div>

      {submitted ? (
        <div className="py-8 text-center space-y-3 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-foreground text-sm">Thank you for your feedback</h4>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your review helps maintain accountability and professional standards across Tradigo. It has been recorded in your session ledger.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Consultation Rating</label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 text-muted-foreground hover:scale-110 transition-transform focus:outline-none"
                >
                  <Star
                    className={cn(
                      "w-7 h-7 transition-colors",
                      (hoverRating || rating) >= star
                        ? "text-amber-500 fill-amber-500 drop-shadow-[0_0_4px_rgba(245,158,11,0.2)]"
                        : "text-muted"
                    )}
                  />
                </button>
              ))}
              <span className="ml-3 text-sm font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-md border border-amber-500/20">
                {rating}.0 / 5.0
              </span>
            </div>
          </div>

          {/* Written Review */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Professional Feedback & Insights</label>
            <div className="relative">
              <textarea
                rows={4}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share how this consultation helped your strategy, risk management, or psychological discipline..."
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
              />
              <div className="absolute bottom-3 right-3 text-xs text-muted-foreground font-medium">
                {review.length}/500
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm shadow-sm transition-all flex items-center space-x-2 active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Submit Accountability Report</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
