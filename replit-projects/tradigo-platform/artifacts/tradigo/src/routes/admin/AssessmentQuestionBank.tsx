import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Check, Edit3, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { auth } from '../../lib/firebase';

type AssessmentType = 'KNOWLEDGE' | 'SAFETY';
type QuestionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
type Question = {
  id: string;
  type: AssessmentType;
  version: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  status: QuestionStatus;
};

const previewQuestions: Question[] = [
  {
    id: 'preview-question-1',
    type: 'KNOWLEDGE',
    version: 'v1.0',
    text: 'What should a coach focus on when reviewing a learner’s chart?',
    options: ['A guaranteed entry', 'The learner’s reasoning and process', 'A private signal', 'Copying the coach'],
    correctAnswer: 'The learner’s reasoning and process',
    explanation: 'The question tests education-only coaching boundaries.',
    status: 'PUBLISHED',
  },
  {
    id: 'preview-question-2',
    type: 'SAFETY',
    version: 'v1.0',
    text: 'What should a coach do if a learner offers account credentials?',
    options: ['Accept them', 'Store them securely', 'Refuse access and explain the boundary', 'Share them with a partner'],
    correctAnswer: 'Refuse access and explain the boundary',
    explanation: 'Coaching never requires account access or credentials.',
    status: 'PUBLISHED',
  },
];

const blankForm = {
  type: 'KNOWLEDGE' as AssessmentType,
  text: '',
  options: ['', '', '', '', '', ''],
  correctAnswer: '',
  explanation: '',
};

const authHeaders = async () => ({ Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` });
const labelize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

export const AssessmentQuestionBank = ({ demoMode = false }: { demoMode?: boolean }) => {
  const [questions, setQuestions] = useState<Question[]>(demoMode ? previewQuestions : []);
  const [loading, setLoading] = useState(!demoMode);
  const [form, setForm] = useState(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadQuestions = async () => {
    if (demoMode) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/assessment-questions', { headers: await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to load the question bank.');
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load the question bank.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuestions(); }, [demoMode]);

  const groupedQuestions = useMemo(
    () => (['KNOWLEDGE', 'SAFETY'] as AssessmentType[]).map(type => ({
      type,
      items: questions.filter(question => question.type === type),
    })),
    [questions],
  );

  const resetForm = () => {
    setForm(blankForm);
    setEditingId(null);
    setFormOpen(false);
  };

  const updateOption = (index: number, value: string) => {
    setForm(current => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? value : option) }));
  };

  const saveQuestion = async () => {
    const options = form.options.map(option => option.trim()).filter(Boolean);
    if (form.text.trim().length < 10 || options.length < 2 || !options.includes(form.correctAnswer.trim())) {
      setError('Add a question, at least two choices, and select one of those choices as the correct answer.');
      return;
    }
    setError('');
    setNotice('');
    const payload = { ...form, text: form.text.trim(), options, correctAnswer: form.correctAnswer.trim(), explanation: form.explanation.trim() };
    if (demoMode) {
      const localQuestion: Question = {
        id: editingId ?? `preview-question-${Date.now()}`,
        version: editingId ? 'v1.1' : 'v1.0',
        status: 'DRAFT',
        ...payload,
      };
      setQuestions(current => editingId ? current.map(question => question.id === editingId ? localQuestion : question) : [localQuestion, ...current]);
      setNotice('Preview only: the question was added to sample data and was not saved.');
      resetForm();
      return;
    }
    try {
      const response = await fetch(editingId ? `/api/admin/assessment-questions/${editingId}` : '/api/admin/assessment-questions', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to save the question.');
      setNotice(data.note || 'Question saved as a draft. Publish it when it is ready for coach onboarding.');
      resetForm();
      await loadQuestions();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save the question.');
    }
  };

  const updateStatus = async (question: Question, action: 'publish' | 'retire') => {
    setError('');
    setNotice('');
    if (demoMode) {
      setQuestions(current => current.map(item => item.id === question.id ? { ...item, status: action === 'publish' ? 'PUBLISHED' : 'RETIRED' } : item));
      setNotice('Preview only: the question status changed in sample data and was not saved.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/assessment-questions/${question.id}/${action}`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || `Unable to ${action} the question.`);
      await loadQuestions();
      setNotice(`Question ${action === 'publish' ? 'published for coach onboarding' : 'retired from coach onboarding'}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Unable to ${action} the question.`);
    }
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><BookOpenCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-foreground">Onboarding assessment question bank</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Tradigo moderators create and publish the questions. Coaches only receive published questions and never see the answer key.</p>
          </div>
        </div>
        {!editingId && <Button variant="outline" onClick={() => { setError(''); setNotice(''); setForm(blankForm); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create question</Button>}
      </div>

      {demoMode && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Preview data · authoring controls are interactive examples only and do not change production assessments.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {formOpen && (
        <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">{editingId ? 'Edit assessment question' : 'Create assessment question'}</h3>
            <button type="button" onClick={resetForm} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Cancel question editing"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Assessment" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as AssessmentType }))} options={[{ label: 'Knowledge', value: 'KNOWLEDGE' }, { label: 'Coaching safety', value: 'SAFETY' }]} />
            <div className="text-xs leading-5 text-muted-foreground sm:pt-7">Use clear, education-only scenarios. Published questions are used immediately for new coach attempts.</div>
          </div>
          <label className="mt-4 block space-y-1.5 text-sm font-medium text-foreground"><span>Question</span><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Example: How should a coach respond to a request for a trade signal?" value={form.text} onChange={event => setForm(current => ({ ...current, text: event.target.value }))} /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {form.options.map((option, index) => <Input key={index} label={`Choice ${index + 1}`} placeholder={`Answer choice ${index + 1}`} value={option} onChange={event => updateOption(index, event.target.value)} />)}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select label="Correct answer" value={form.correctAnswer} onChange={event => setForm(current => ({ ...current, correctAnswer: event.target.value }))} options={[{ label: 'Select the correct choice', value: '' }, ...form.options.filter(Boolean).map(option => ({ label: option, value: option }))]} />
            <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Reviewer explanation (optional)</span><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Why this answer reflects Tradigo’s standard." value={form.explanation} onChange={event => setForm(current => ({ ...current, explanation: event.target.value }))} /></label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={resetForm}>Cancel</Button><Button onClick={saveQuestion}><Check className="mr-2 h-4 w-4" /> Save as draft</Button></div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {loading ? <p className="text-sm text-muted-foreground">Loading question bank…</p> : groupedQuestions.map(group => (
          <div key={group.type} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-foreground">{labelize(group.type)} questions</h3><span className="text-xs text-muted-foreground">{group.items.length} total</span></div>
            <div className="mt-3 space-y-3">
              {group.items.length === 0 && <p className="text-sm text-muted-foreground">No questions created yet.</p>}
              {group.items.map(question => (
                <div key={question.id} className="rounded-lg bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-semibold text-foreground">{question.text}</p><p className="mt-1 text-xs text-muted-foreground">{question.options.length} choices · {question.version}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${question.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : question.status === 'RETIRED' ? 'bg-secondary text-muted-foreground' : 'bg-amber-100 text-amber-800'}`}>{question.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {question.status !== 'PUBLISHED' && <Button variant="outline" onClick={() => { setEditingId(question.id); setFormOpen(true); setForm({ type: question.type, text: question.text, options: Array.from({ length: 6 }, (_, index) => question.options[index] ?? ''), correctAnswer: question.correctAnswer, explanation: question.explanation ?? '' }); }}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>}
                    {question.status !== 'PUBLISHED' && <Button variant="outline" onClick={() => updateStatus(question, 'publish')}><Send className="mr-1.5 h-3.5 w-3.5" /> Publish</Button>}
                    {question.status === 'PUBLISHED' && <Button variant="outline" onClick={() => { setEditingId(question.id); setFormOpen(true); setForm({ type: question.type, text: question.text, options: Array.from({ length: 6 }, (_, index) => question.options[index] ?? ''), correctAnswer: question.correctAnswer, explanation: question.explanation ?? '' }); }}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> New revision</Button>}
                    {question.status === 'PUBLISHED' && <Button variant="outline" onClick={() => updateStatus(question, 'retire')}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Retire</Button>}
                    {question.status === 'RETIRED' && <Button variant="outline" onClick={() => updateStatus(question, 'publish')}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore</Button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};