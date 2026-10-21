import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { auth } from '../../../lib/firebase';

type AssessmentType = 'KNOWLEDGE' | 'SAFETY';

type Question = {
  id: string;
  text: string;
  options: string[];
};

type Result = {
  status: string;
  passed: boolean;
  score: number;
  maxScore: number;
  attemptNumber: number;
};

interface Props {
  type: AssessmentType;
  onComplete: () => void;
  onCancel: () => void;
}

export const CoachAssessment = ({ type, onComplete, onCancel }: Props) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchQuestions = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/coaches/assessments', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'Unable to load the assessment.');
        if (!cancelled) setQuestions(type === 'KNOWLEDGE' ? data.knowledge ?? [] : data.safety ?? []);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load the assessment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchQuestions();
    return () => { cancelled = true; };
  }, [type]);

  const handleSubmit = async () => {
    const unanswered = questions.some(question => !answers[question.id]);
    if (unanswered) {
      setError('Answer every question before submitting.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/coaches/assessments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to submit the assessment.');
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit the assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading assessment questions…</div>;

  if (result) {
    return (
      <div className="space-y-5">
        <div className={`rounded-xl border p-5 ${result.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {type === 'KNOWLEDGE' ? 'Knowledge' : 'Safety'} assessment · attempt {result.attemptNumber}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-foreground">
            {result.passed ? 'Assessment passed' : 'Assessment needs another attempt'}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Score: <strong>{result.score}/{result.maxScore}</strong>. {result.passed
              ? 'This result is now visible to the review team.'
              : 'Review the learning material and try again before submitting your application.'}
          </p>
        </div>
        <Button onClick={onComplete}>Return to application</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          {type === 'KNOWLEDGE' ? 'Knowledge' : 'Coaching & safety'} assessment
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tradigo writes the standardized questions. You answer them; moderators review your score and submitted responses.
        </p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            No questions are available right now. Please return later.
          </div>
        ) : questions.map((question, index) => (
          <fieldset key={question.id} className="rounded-xl border border-border p-4">
            <legend className="max-w-full px-1 text-sm font-semibold leading-5 text-foreground">
              {index + 1}. {question.text}
            </legend>
            <div className="mt-3 space-y-2">
              {question.options.map(option => (
                <label key={option} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3 text-sm text-foreground hover:bg-secondary/50">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => setAnswers(current => ({ ...current, [question.id]: option }))}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting || questions.length === 0}>
          {submitting ? 'Submitting…' : 'Submit assessment'}
        </Button>
      </div>
    </div>
  );
};