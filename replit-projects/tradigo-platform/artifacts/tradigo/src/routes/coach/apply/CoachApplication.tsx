import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck, Upload } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { auth } from '../../../lib/firebase';
import { trackEvent } from '../../../lib/analytics';
import { CoachAssessment } from './CoachAssessment';
import { CoachApplicationStatusPanel } from './CoachApplicationStatus';

type AssessmentType = 'KNOWLEDGE' | 'SAFETY';
type Section = 'profile' | 'markets' | 'experience' | 'compliance';

const marketOptions = ['FOREX', 'CRYPTO', 'INDICES', 'COMMODITIES', 'EQUITIES', 'FUTURES', 'OPTIONS'];
const instrumentOptions = ['Currency pairs', 'Spot crypto', 'US equities', 'Index futures', 'Commodities', 'Options basics'];
const styleOptions = ['Day trading', 'Swing trading', 'Position trading', 'Long-term investing education'];
const methodologyOptions = ['Price action', 'Market structure', 'Risk framework', 'Trade journaling', 'Process building', 'Trading psychology'];
const specialtyOptions = ['MARKET_STRUCTURE', 'ENTRY_TIMING', 'RISK_MANAGEMENT', 'TRADE_REVIEW', 'STRATEGY', 'TRADING_PSYCHOLOGY', 'PLATFORM_HELP', 'GENERAL_COACHING'];
const languageOptions = ['Arabic', 'English', 'French', 'Mandarin', 'Spanish', 'Turkish'];

const initialForm = {
  profile: {
    contactEmail: '',
    displayName: '',
    headline: '',
    bio: '',
    teachingMethod: '',
    coachingBoundaries: '',
    languages: [] as string[],
    hourlyRateCents: 5000,
    instantRatePerMinuteCents: 100,
  },
  markets: {
    markets: [] as string[],
    instruments: [] as string[],
    tradingStyles: [] as string[],
    methodologies: [] as string[],
    coachingSpecialties: [] as string[],
  },
  experience: {
    yearsExperience: 1,
    background: '',
    teachingExperience: '',
    representativeWork: '',
  },
  compliance: {
    remoteControl: '',
    credentials: '',
    offPlatform: '',
    jurisdiction: '',
  },
  verification: { identity: 'PENDING', provider: 'PAYPAL' },
  assessmentAttempts: [] as any[],
  documents: [] as any[],
};

const authHeaders = async () => ({
  Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
});

const mergeForm = (data: any) => ({
  ...initialForm,
  ...data,
  profile: { ...initialForm.profile, ...(data.profile ?? {}) },
  markets: { ...initialForm.markets, ...(data.markets ?? {}) },
  experience: { ...initialForm.experience, ...(data.experience ?? {}) },
  compliance: { ...initialForm.compliance, ...(data.compliance ?? {}) },
  verification: { ...initialForm.verification, ...(data.verifications ?? data.verification ?? {}) },
  assessmentAttempts: Array.isArray(data.assessmentAttempts) ? data.assessmentAttempts : [],
  documents: Array.isArray(data.documents) ? data.documents : [],
});

const toggleValue = (values: string[], value: string) =>
  values.includes(value) ? values.filter(item => item !== value) : [...values, value];

const latestAssessment = (attempts: any[], type: AssessmentType) =>
  attempts.find(attempt => attempt.type === type);

export const CoachApplication = () => {
  const { canonicalUser } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState<AssessmentType | null>(null);
  const [formData, setFormData] = useState<any>(initialForm);
  const [appStatus, setAppStatus] = useState('DRAFT');
  const [error, setError] = useState('');
  const [documentForm, setDocumentForm] = useState({ documentType: 'CERTIFICATE', name: '', description: '', issuer: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentSubmitting, setDocumentSubmitting] = useState(false);

  const fetchApp = async () => {
    try {
      const response = await fetch('/api/coaches/application', { headers: await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to load your application.');
      setFormData(mergeForm(data));
      setStep(Math.min(7, Math.max(1, Number(data.currentStep) || 1)));
      setAppStatus(data.status || 'DRAFT');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load your application.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApp(); }, []);

  const updateSection = (section: Section, key: string, value: any) => {
    setFormData((current: any) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  };

  const saveStep = async (stepNumber: number, section: Section) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/coaches/application', {
        method: 'PUT',
        headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: stepNumber, data: formData[section] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to save this step.');
      setFormData(mergeForm(data));
      setStep(stepNumber + 1);
      trackEvent('coach_application_continued', { source: 'application_step', completed_step: stepNumber });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save this step.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDocument = async () => {
    if (!documentForm.name.trim()) {
      setError('Give the document a name before adding it.');
      return;
    }
    setDocumentSubmitting(true);
    setError('');
    try {
      let objectPath: string | null = null;
      if (selectedFile) {
        const uploadRequest = await fetch('/api/storage/uploads/request-url', {
          method: 'POST',
          headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedFile.name,
            size: selectedFile.size,
            contentType: selectedFile.type,
            documentType: documentForm.documentType,
          }),
        });
        const uploadData = await uploadRequest.json();
        if (!uploadRequest.ok) throw new Error(uploadData?.error?.message || 'Unable to prepare the upload.');
        const upload = await fetch(uploadData.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type },
          body: selectedFile,
        });
        if (!upload.ok) throw new Error('The document upload did not complete.');
        objectPath = uploadData.objectPath;
      }
      const response = await fetch('/api/coaches/application/documents', {
        method: 'POST',
        headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...documentForm,
          objectPath,
          mimeType: selectedFile?.type,
          sizeBytes: selectedFile?.size,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to save this document.');
      setFormData((current: any) => ({ ...current, documents: [data, ...(current.documents ?? [])] }));
      setDocumentForm({ documentType: 'CERTIFICATE', name: '', description: '', issuer: '' });
      setSelectedFile(null);
      const fileInput = document.getElementById('coach-evidence-file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save this document.');
    } finally {
      setDocumentSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const saveResponse = await fetch('/api/coaches/application', {
        method: 'PUT',
        headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 6, data: formData.compliance }),
      });
      if (!saveResponse.ok) {
        const data = await saveResponse.json();
        throw new Error(data?.error?.message || 'Unable to save your declarations.');
      }
      const response = await fetch('/api/coaches/application/submit', { method: 'POST', headers: await authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to submit your application.');
      setFormData(mergeForm(data));
      setAppStatus('UNDER_REVIEW');
      useAuthStore.getState().setCoachApplicationStatus('UNDER_REVIEW');
      trackEvent('coach_application_submitted');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit your application.');
    } finally {
      setSubmitting(false);
    }
  };

  const attempts = formData.assessmentAttempts ?? [];
  const requiredDeclarations = Object.values(formData.compliance ?? {}).filter(Boolean).length;
  const completedAssessments = ['KNOWLEDGE', 'SAFETY'].filter(type => latestAssessment(attempts, type as AssessmentType)?.status === 'PASSED').length;
  const profileReady = Boolean(formData.profile.headline && formData.profile.bio && formData.profile.teachingMethod && formData.profile.coachingBoundaries);
  const experienceReady = Boolean(formData.experience.yearsExperience && formData.experience.background);
  const summaryItems = useMemo(() => [
    ['Profile', profileReady],
    ['Scope and experience', experienceReady && formData.markets.markets.length > 0],
    ['Assessments', completedAssessments === 2],
    ['Declarations', requiredDeclarations === 4],
  ] as Array<[string, boolean]>, [profileReady, experienceReady, formData.markets.markets.length, completedAssessments, requiredDeclarations]);

  const renderChoices = (label: string, values: string[], options: string[], onChange: (values: string[]) => void) => (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const selected = values.includes(option);
          return (
            <button
              type="button"
              key={option}
              onClick={() => onChange(toggleValue(values, option))}
              aria-pressed={selected}
              className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}
            >
              {option.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-foreground">Your coach profile</h2><p className="mt-1 text-sm text-muted-foreground">Tell learners what you teach and how you keep coaching educational.</p></div>
      <Input label="Public headline" placeholder="Structured price-action coach" value={formData.profile.headline} onChange={event => updateSection('profile', 'headline', event.target.value)} />
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Short bio</span><textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.profile.bio} onChange={event => updateSection('profile', 'bio', event.target.value)} placeholder="Describe who you help and what learners can practice." /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Teaching method</span><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.profile.teachingMethod} onChange={event => updateSection('profile', 'teachingMethod', event.target.value)} placeholder="How will a typical session help a learner?" /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Coaching boundaries</span><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.profile.coachingBoundaries} onChange={event => updateSection('profile', 'coachingBoundaries', event.target.value)} placeholder="Confirm no signals, execution, account access, guarantees, or performance promises." /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Hourly rate (USD)" type="number" min="1" value={(Number(formData.profile.hourlyRateCents) || 0) / 100} onChange={event => updateSection('profile', 'hourlyRateCents', Math.round(Number(event.target.value || 0) * 100))} />
        <Input label="Instant rate per minute (USD cents)" type="number" min="1" value={formData.profile.instantRatePerMinuteCents} onChange={event => updateSection('profile', 'instantRatePerMinuteCents', Math.max(1, Number(event.target.value || 0)))} />
      </div>
      {renderChoices('Languages you can coach in', formData.profile.languages, languageOptions, values => updateSection('profile', 'languages', values))}
      <div className="flex justify-end pt-2"><Button onClick={() => saveStep(1, 'profile')} disabled={submitting || !profileReady}>{submitting ? 'Saving…' : 'Save & continue'}</Button></div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-foreground">Teaching scope</h2><p className="mt-1 text-sm text-muted-foreground">Choose only the markets, methods, and learner needs you can support responsibly.</p></div>
      {renderChoices('Markets', formData.markets.markets, marketOptions, values => updateSection('markets', 'markets', values))}
      {renderChoices('Instruments', formData.markets.instruments, instrumentOptions, values => updateSection('markets', 'instruments', values))}
      {renderChoices('Trading styles', formData.markets.tradingStyles, styleOptions, values => updateSection('markets', 'tradingStyles', values))}
      {renderChoices('Methodologies', formData.markets.methodologies, methodologyOptions, values => updateSection('markets', 'methodologies', values))}
      {renderChoices('Coaching specialties', formData.markets.coachingSpecialties, specialtyOptions, values => updateSection('markets', 'coachingSpecialties', values))}
      <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button onClick={() => saveStep(2, 'markets')} disabled={submitting || !formData.markets.markets.length || !formData.markets.coachingSpecialties.length}>Save & continue</Button></div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-foreground">Experience and availability</h2><p className="mt-1 text-sm text-muted-foreground">Administrators use this to confirm your teaching scope and market fit.</p></div>
      <Input label="Years of trading experience" type="number" min="1" max="80" value={formData.experience.yearsExperience} onChange={event => updateSection('experience', 'yearsExperience', Math.max(0, Number(event.target.value || 0)))} />
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Trading background</span><textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.experience.background} onChange={event => updateSection('experience', 'background', event.target.value)} placeholder="Markets studied, years active, and the process you can explain." /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Teaching experience</span><textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.experience.teachingExperience} onChange={event => updateSection('experience', 'teachingExperience', event.target.value)} placeholder="Formal teaching, peer coaching, workshops, or mentoring." /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Availability</span><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.experience.availability ?? ''} onChange={event => updateSection('experience', 'availability', event.target.value)} placeholder="Example: weekday evenings, 2–3 sessions per week." /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Representative work or profile link</span><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={formData.experience.representativeWork} onChange={event => updateSection('experience', 'representativeWork', event.target.value)} placeholder="Optional: public profile, teaching sample, or portfolio context." /></label>
      <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(2)}>Back</Button><Button onClick={() => saveStep(3, 'experience')} disabled={submitting || !experienceReady}>Save & continue</Button></div>
    </div>
  );

  const renderStep4 = () => {
    if (activeAssessment) return <CoachAssessment type={activeAssessment} onComplete={() => { setActiveAssessment(null); fetchApp(); }} onCancel={() => setActiveAssessment(null)} />;
    return (
      <div className="space-y-5">
        <div><h2 className="text-2xl font-bold text-foreground">Assessments</h2><p className="mt-1 text-sm text-muted-foreground">Both assessments are required. Your answers and every attempt are retained for moderator review.</p></div>
        {(['KNOWLEDGE', 'SAFETY'] as AssessmentType[]).map(type => {
          const latest = latestAssessment(attempts, type);
          return (
            <div key={type} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-semibold text-foreground">{type === 'KNOWLEDGE' ? 'Trading knowledge' : 'Coaching safety'}</h3><p className="mt-1 text-sm text-muted-foreground">{latest ? `Latest attempt: ${latest.score}/${latest.maxScore} · ${latest.status}` : 'Not completed yet'}</p></div>
                <Button variant="outline" onClick={() => setActiveAssessment(type)}>{latest ? 'Retake assessment' : 'Start assessment'}</Button>
              </div>
              {latest?.answers?.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{latest.answers.length} answers stored for moderator review · attempt {latest.attemptNumber}</p>}
            </div>
          );
        })}
        <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(3)}>Back</Button><Button onClick={() => setStep(5)} disabled={completedAssessments !== 2}>Continue to documents</Button></div>
      </div>
    );
  };

  const renderStep5 = () => (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-foreground">Documents and verification</h2><p className="mt-1 text-sm text-muted-foreground">Add non-sensitive evidence such as a teaching sample, certification, or professional profile. Tradigo does not store government ID images; payout-provider verification is separate.</p></div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Provider identity status: <strong className="text-foreground">{formData.verification.identity}</strong>. This status is updated by the payout provider.</div>
      <div className="space-y-4 rounded-xl border border-border p-4">
        <Select label="Evidence type" value={documentForm.documentType} onChange={event => setDocumentForm(current => ({ ...current, documentType: event.target.value }))} options={[{ label: 'Certification or qualification', value: 'CERTIFICATE' }, { label: 'Teaching sample', value: 'TEACHING_SAMPLE' }, { label: 'Professional profile', value: 'PROFESSIONAL_PROFILE' }, { label: 'Other supporting evidence', value: 'OTHER' }]} />
        <Input label="Document name" placeholder="Market education certificate" value={documentForm.name} onChange={event => setDocumentForm(current => ({ ...current, name: event.target.value }))} />
        <Input label="Issuer or source (optional)" placeholder="Issuing organization or website" value={documentForm.issuer} onChange={event => setDocumentForm(current => ({ ...current, issuer: event.target.value }))} />
        <label className="block space-y-1.5 text-sm font-medium text-foreground"><span>Description</span><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={documentForm.description} onChange={event => setDocumentForm(current => ({ ...current, description: event.target.value }))} placeholder="What should the reviewer verify?" /></label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"><Upload className="h-5 w-5 text-primary" /><span className="flex-1"><strong className="block text-foreground">Attach a PDF, PNG, or JPEG (optional)</strong><span>Maximum 10 MB. Do not upload government identity documents.</span></span><input id="coach-evidence-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="max-w-[180px] text-xs" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} /></label>
        <Button variant="outline" onClick={addDocument} disabled={documentSubmitting}>{documentSubmitting ? 'Uploading…' : 'Add evidence'}</Button>
      </div>
      <div className="space-y-2">
        {(formData.documents ?? []).filter((document: any) => document.type !== 'APPLICATION_RECORD').map((document: any) => <div key={document.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3"><FileText className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold text-foreground">{document.name}</p><p className="text-xs text-muted-foreground">{document.type?.replace(/_/g, ' ')} · {document.fileAvailable ? 'File uploaded' : 'Metadata saved'} · {document.status}</p></div></div>)}
        {!formData.documents?.filter((document: any) => document.type !== 'APPLICATION_RECORD').length && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No supporting documents added yet. You can continue, but the moderator will see that evidence is missing.</p>}
      </div>
      <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(4)}>Back</Button><Button onClick={() => setStep(6)}>Continue to declarations</Button></div>
    </div>
  );

  const renderStep6 = () => {
    const declarations = [
      ['remoteControl', 'I will never remotely control, manage, or place trades in a learner’s account.'],
      ['credentials', 'I will never request passwords, private keys, or account credentials.'],
      ['offPlatform', 'I will keep coaching payments and bookings inside Tradigo.'],
      ['jurisdiction', 'I will follow Tradigo policies and provide education only, without signals, guarantees, or performance promises.'],
    ] as const;
    return (
      <div className="space-y-5">
        <div><h2 className="text-2xl font-bold text-foreground">Safety declarations</h2><p className="mt-1 text-sm text-muted-foreground">These declarations become part of the application record reviewed by administrators.</p></div>
        <div className="space-y-3">{declarations.map(([key, text]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 text-sm text-foreground"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={Boolean(formData.compliance[key])} onChange={event => updateSection('compliance', key, event.target.checked ? 'v1.0' : '')} /><span>{text}</span></label>)}</div>
        <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(5)}>Back</Button><Button onClick={() => setStep(7)} disabled={requiredDeclarations !== 4}>Review application</Button></div>
      </div>
    );
  };

  const renderStep7 = () => (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-bold text-foreground">Review and submit</h2><p className="mt-1 text-sm text-muted-foreground">Check each evidence category before sending your application to the review team.</p></div>
      <div className="space-y-2">{summaryItems.map(([label, ready]) => <div key={label} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">{ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}<span className="text-foreground">{label}</span><span className="ml-auto text-xs font-semibold text-muted-foreground">{ready ? 'Complete' : 'Needs attention'}</span></div>)}</div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Before submitting:</strong> administrators will review your full profile, assessment answers and scores, declarations, and evidence records. Provider identity verification may remain pending until payout setup.</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-between pt-2"><Button variant="outline" onClick={() => setStep(6)}>Back</Button><Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</Button></div>
    </div>
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading your coach application…</div>;
  if (!canonicalUser) return null;
  if (appStatus !== 'DRAFT') {
    return (
      <CoachApplicationStatusPanel
        application={{
          id: formData.id,
          status: appStatus,
          currentStep: formData.currentStep,
          submittedAt: formData.submittedAt ?? formData.submitted_at,
          decidedAt: formData.decidedAt,
          reviewerNote: formData.reviewerNote,
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground"><span className="shrink-0">Step {step} of 7</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${(step / 7) * 100}%` }} /></div></div>
        {error && step !== 7 && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
        {step === 7 && renderStep7()}
      </div>
    </div>
  );
};