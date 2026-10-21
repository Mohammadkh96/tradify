import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '../../lib/firebase';
import { trackEvent } from '../../lib/analytics';
import { Button } from '../../components/ui/Button';
import { AssessmentQuestionBank } from './AssessmentQuestionBank';
import {
  ArrowLeftRight,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  History,
  Link2,
  MessageCircleQuestion,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

type ApplicationDecision = 'APPROVE' | 'REJECT';

type ReviewCheckKey =
  | 'profile'
  | 'experience'
  | 'knowledge'
  | 'safety'
  | 'compliance';

const reviewChecks: { key: ReviewCheckKey; label: string }[] = [
  { key: 'profile', label: 'Profile and teaching scope reviewed' },
  { key: 'experience', label: 'Experience and market fit reviewed' },
  { key: 'knowledge', label: 'Knowledge assessment reviewed' },
  { key: 'safety', label: 'Safety assessment reviewed' },
  { key: 'compliance', label: 'Compliance declarations reviewed' },
];

const previewTeachingSampleUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f7f5ef"/><rect x="52" y="52" width="1096" height="696" rx="24" fill="#ffffff" stroke="#d9e1ea" stroke-width="4"/><text x="100" y="150" fill="#132238" font-family="Arial" font-size="42" font-weight="700">Annotated teaching sample</text><text x="100" y="220" fill="#5e7185" font-family="Arial" font-size="25">Preview evidence · education-only market structure review</text><path d="M130 590 C260 420 330 510 450 360 S680 470 790 260 S980 300 1070 190" fill="none" stroke="#2f80ed" stroke-width="10"/><path d="M130 610 L1070 610" stroke="#d9e1ea" stroke-width="3"/><circle cx="790" cy="260" r="16" fill="#f2994a"/><text x="100" y="690" fill="#132238" font-family="Arial" font-size="22">Sample file only — no production document is changed.</text></svg>`)}`;

const previewApplications: any[] = [
  {
    id: 'application_17',
    display_name: 'Nadia Rahman',
    email: 'nadia@demo.tradigo.app',
    submitted_at: '2026-08-24T09:30:00.000Z',
    years_experience: 6,
    status: 'UNDER_REVIEW',
    profile: {
      headline: 'Structured price-action coach',
      bio: 'I help developing traders slow down their process, read market structure, and turn a trading idea into a documented learning plan.',
      hourlyRateCents: 7200,
      instantRatePerMinuteCents: 150,
      teachingMethod: 'Structured screen-share review with a written practice step after every session.',
      coachingBoundaries: 'Education only. No trade execution, account access, signals, or guaranteed outcomes.',
    },
    markets: {
      markets: ['FOREX', 'INDICES'],
      instruments: ['Currency pairs', 'Index futures'],
      tradingStyles: ['Day trading', 'Swing trading'],
      methodologies: ['Price action', 'Market structure'],
      coachingSpecialties: ['MARKET_STRUCTURE', 'ENTRY_TIMING', 'TRADE_REVIEW'],
    },
    experience: {
      yearsExperience: 6,
      background: 'Six years of discretionary FX and index study with a focus on journaling and post-trade review.',
    },
    verifications: {
      identity: 'VERIFIED',
      knowledge: 'PASSED',
      safety: 'PASSED',
      provider: 'PAYPAL',
      hostedReviewUrl: 'https://www.paypal.com/compliance/review/demo-17',
      providerReference: 'PAYPAL-KYC-17A4',
      hostedReviewUrlExpiresAt: '2026-09-24T09:21:00.000Z',
      lastCheckedAt: '2026-08-24T09:21:00.000Z',
      providerReviewStatus: 'AVAILABLE',
      identityDecision: {
        decision: 'VERIFIED',
        responsibleParty: 'PayPal Identity Verification',
        recordedBy: 'provider-webhook:paypal',
        recordedAt: '2026-08-24T09:21:00.000Z',
        decidedAt: '2026-08-24T09:20:00.000Z',
        basis: 'The provider matched the submitted legal name, validated the identity document, completed liveness review, and returned no sanctions screening match.',
        source: 'PROVIDER_WEBHOOK',
        checks: { documentNameMatch: 'PASS', documentValidity: 'PASS', liveness: 'PASS', sanctionsScreening: 'PASS' },
        reasonCodes: [],
      },
      identityHistory: [
        { action: 'IDENTITY_VERIFICATION_DECISION', actorId: 'provider-webhook:paypal', createdAt: '2026-08-24T09:21:00.000Z', decision: 'VERIFIED', provider: 'PAYPAL', responsibleParty: 'PayPal Identity Verification', basis: 'Name, document validity, liveness, and sanctions checks passed.', source: 'PROVIDER_WEBHOOK', decidedAt: '2026-08-24T09:20:00.000Z', checks: { documentNameMatch: 'PASS', documentValidity: 'PASS', liveness: 'PASS', sanctionsScreening: 'PASS' } },
      ],
    },
    assessmentAttempts: [
      {
        id: 'assessment_17_knowledge_1', type: 'KNOWLEDGE', status: 'PASSED', score: 9, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-24T08:58:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'Explains risk and uncertainty without making performance claims.',
        answers: [
          { id: 'answer_17_k1', questionText: 'What should a coach do when a learner asks whether they should buy or sell an instrument?', answer: 'Explain educational concepts and ask the learner to make their own decision', isCorrect: true },
          { id: 'answer_17_k2', questionText: 'Which statement best describes sound risk education?', answer: 'A learner should understand uncertainty, position sizing, and possible loss', isCorrect: true },
          { id: 'answer_17_k3', questionText: 'What is the most useful purpose of a trading journal?', answer: 'To record decisions and review process quality over time', isCorrect: true },
        ],
      },
      {
        id: 'assessment_17_safety_1', type: 'SAFETY', status: 'PASSED', score: 10, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-24T09:04:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'Correctly rejects account access, credentials, signals, and trade execution.',
        answers: [
          { id: 'answer_17_s1', questionText: 'A learner offers a password so you can place a trade. What is the correct response?', answer: 'Refuse access and explain that coaching never requires credentials', isCorrect: true },
          { id: 'answer_17_s2', questionText: 'A learner asks for a signal during a paid session. What should you do?', answer: 'Reframe the request into education about analysis and decision-making', isCorrect: true },
          { id: 'answer_17_s3', questionText: 'Which activity is outside Tradigo’s coaching boundaries?', answer: 'Managing or controlling a learner’s brokerage account', isCorrect: true },
        ],
      },
    ],
    documents: [
      { id: 'document_17_application', name: 'Coach application declaration', type: 'APPLICATION_RECORD', status: 'RECEIVED', submittedAt: '2026-08-24T09:30:00.000Z', fileAvailable: false, description: 'Structured application data and accepted platform policies.' },
      { id: 'document_17_teaching', name: 'Annotated teaching sample', type: 'TEACHING_SAMPLE', status: 'RECEIVED', submittedAt: '2026-08-24T09:18:00.000Z', fileAvailable: true, mimeType: 'image/svg+xml', previewUrl: previewTeachingSampleUrl, description: 'Preview sample demonstrating the inline document viewer.' },
      { id: 'document_17_identity', name: 'Payment-provider identity check', type: 'PROVIDER_VERIFICATION', status: 'VERIFIED', submittedAt: '2026-08-24T09:21:00.000Z', fileAvailable: false, description: 'Verification result received from the payout provider. Tradigo does not store an ID image.' },
    ],
    languages: ['Arabic', 'English'],
    availability: 'Weekday evenings · 2–3 sessions per week',
    compliance: {
      remoteControl: 'v1.0',
      credentials: 'v1.0',
      offPlatform: 'v1.0',
      jurisdiction: 'v1.0',
    },
    reviewFlags: [],
  },
  {
    id: 'application_16',
    display_name: 'Elias Morgan',
    email: 'elias@demo.tradigo.app',
    submitted_at: '2026-08-22T14:10:00.000Z',
    years_experience: 9,
    status: 'UNDER_REVIEW',
    profile: {
      headline: 'Risk and execution-process mentor',
      bio: 'I work with traders on risk planning, emotional discipline, and reviewing the decisions that happen before an entry.',
      hourlyRateCents: 8800,
      instantRatePerMinuteCents: 185,
      teachingMethod: 'Diagnostic conversation followed by an annotated review and one measurable practice goal.',
      coachingBoundaries: 'Will not handle credentials or place trades. Needs a final safety clarification before approval.',
    },
    markets: {
      markets: ['CRYPTO', 'EQUITIES'],
      instruments: ['Spot crypto', 'Large-cap equities'],
      tradingStyles: ['Position trading', 'Swing trading'],
      methodologies: ['Risk framework', 'Trade journaling'],
      coachingSpecialties: ['RISK_MANAGEMENT', 'TRADING_PSYCHOLOGY', 'TRADE_REVIEW'],
    },
    experience: {
      yearsExperience: 9,
      background: 'Nine years of market participation and peer education, with an emphasis on position sizing and review discipline.',
    },
    verifications: {
       identity: 'DECLINED',
      knowledge: 'PASSED',
      safety: 'NEEDS_REVIEW',
      provider: 'PAYPAL',
      hostedReviewUrl: 'https://www.paypal.com/compliance/review/demo-16',
      providerReference: 'PAYPAL-KYC-16B2',
      hostedReviewUrlExpiresAt: '2026-08-20T13:30:00.000Z',
      lastCheckedAt: '2026-08-19T13:30:00.000Z',
      providerReviewStatus: 'EXPIRED',
      identityDecision: {
        decision: 'DECLINED',
        responsibleParty: 'PayPal Identity Verification',
        recordedBy: 'moderator:identity-review',
        recordedAt: '2026-08-19T13:31:00.000Z',
        decidedAt: '2026-08-19T13:30:00.000Z',
        basis: 'The provider could not confirm the submitted identity document during review; the marketplace application must remain blocked until a new verification is completed.',
        source: 'PROVIDER_PORTAL',
        checks: { documentNameMatch: 'REVIEW', documentValidity: 'FAIL', liveness: 'NOT_CHECKED', sanctionsScreening: 'NOT_CHECKED' },
        reasonCodes: ['DOCUMENT_UNREADABLE', 'VERIFICATION_REQUIRED'],
      },
      identityHistory: [
        { action: 'IDENTITY_VERIFICATION_DECISION', actorId: 'moderator:identity-review', createdAt: '2026-08-19T13:31:00.000Z', decision: 'DECLINED', provider: 'PAYPAL', responsibleParty: 'PayPal Identity Verification', basis: 'Provider document review could not confirm the identity document.', source: 'PROVIDER_PORTAL', decidedAt: '2026-08-19T13:30:00.000Z', checks: { documentNameMatch: 'REVIEW', documentValidity: 'FAIL', liveness: 'NOT_CHECKED', sanctionsScreening: 'NOT_CHECKED' }, reasonCodes: ['DOCUMENT_UNREADABLE', 'VERIFICATION_REQUIRED'] },
      ],
    },
    assessmentAttempts: [
      { id: 'assessment_16_knowledge_1', type: 'KNOWLEDGE', status: 'PASSED', score: 8, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-22T13:18:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'Knowledge result is complete; confirm the coach can stay within education-only boundaries.' },
      { id: 'assessment_16_safety_1', type: 'SAFETY', status: 'NEEDS_REVIEW', score: 6, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-22T13:25:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'Responses require moderator review before approval.' },
    ],
    documents: [
      { id: 'document_16_application', name: 'Coach application declaration', type: 'APPLICATION_RECORD', status: 'RECEIVED', submittedAt: '2026-08-22T14:10:00.000Z', fileAvailable: false, description: 'Structured application data and accepted platform policies.' },
       { id: 'document_16_identity', name: 'Payment-provider identity check', type: 'PROVIDER_VERIFICATION', status: 'DECLINED', submittedAt: '2026-08-19T13:30:00.000Z', fileAvailable: false, description: 'No government ID image is stored in Tradigo; the provider could not confirm the submitted identity document.' },
    ],
    languages: ['English'],
    availability: 'Weekends · availability needs confirmation',
    compliance: {
      remoteControl: 'v1.0',
      credentials: 'v1.0',
      offPlatform: '',
      jurisdiction: 'v1.0',
    },
     reviewFlags: ['Identity verification was declined by the provider.', 'Safety assessment needs moderator review.', 'Off-platform payment declaration is incomplete.'],
  },
  {
    id: 'application_15',
    display_name: 'Sofia Haddad',
    email: 'sofia@demo.tradigo.app',
    submitted_at: '2026-08-19T11:45:00.000Z',
    years_experience: 4,
    status: 'APPROVED',
    decided_by: 'moderator:admin-42',
    decided_at: '2026-08-19T12:05:00.000Z',
    reviewer_note: 'Approved after reviewing the provider identity result, assessments, teaching sample, and compliance declarations.',
    profile: {
      headline: 'Beginner-friendly trading process coach',
      bio: 'I make market concepts approachable through examples, calm questioning, and repeatable review habits.',
      hourlyRateCents: 5600,
      instantRatePerMinuteCents: 115,
      teachingMethod: 'Example-led teaching with simple language and a practical homework prompt.',
      coachingBoundaries: 'No signals, execution, account access, or performance claims.',
    },
    markets: {
      markets: ['EQUITIES', 'OPTIONS'],
      instruments: ['US equities', 'Options basics'],
      tradingStyles: ['Swing trading'],
      methodologies: ['Trade review', 'Process building'],
      coachingSpecialties: ['GENERAL_COACHING', 'PLATFORM_HELP', 'TRADE_REVIEW'],
    },
    experience: {
      yearsExperience: 4,
      background: 'Four years of equities study and coaching peers through structured learning plans.',
    },
    verifications: {
      identity: 'VERIFIED',
      knowledge: 'PASSED',
      safety: 'PASSED',
      provider: 'PAYPAL',
      providerReference: 'PAYPAL-KYC-15C9',
      lastCheckedAt: '2026-08-19T11:29:00.000Z',
      providerReviewStatus: 'REFERENCE_ONLY',
      identityDecision: {
        decision: 'VERIFIED',
        responsibleParty: 'PayPal Identity Verification',
        recordedBy: 'moderator:identity-review',
        recordedAt: '2026-08-19T11:30:00.000Z',
        decidedAt: '2026-08-19T11:29:00.000Z',
        basis: 'The provider returned a verified result and passed the identity checks. The hosted review link is no longer available, so the provider reference is retained for audit.',
        source: 'PROVIDER_PORTAL',
        checks: { documentNameMatch: 'PASS', documentValidity: 'PASS', liveness: 'PASS', sanctionsScreening: 'PASS' },
        reasonCodes: [],
      },
      identityHistory: [
        { action: 'IDENTITY_VERIFICATION_DECISION', actorId: 'moderator:identity-review', createdAt: '2026-08-19T11:30:00.000Z', decision: 'VERIFIED', provider: 'PAYPAL', responsibleParty: 'PayPal Identity Verification', basis: 'Provider verified the identity checks; hosted link was not retained.', source: 'PROVIDER_PORTAL', decidedAt: '2026-08-19T11:29:00.000Z', checks: { documentNameMatch: 'PASS', documentValidity: 'PASS', liveness: 'PASS', sanctionsScreening: 'PASS' } },
      ],
    },
    assessmentAttempts: [
      { id: 'assessment_15_knowledge_1', type: 'KNOWLEDGE', status: 'PASSED', score: 10, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-19T10:40:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'Clear, beginner-appropriate explanations.' },
      { id: 'assessment_15_safety_1', type: 'SAFETY', status: 'PASSED', score: 10, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-19T10:46:00.000Z', version: 'v1.0', answersReviewed: 10, reviewerNote: 'No prohibited account access, signals, or guarantee language.' },
    ],
    documents: [
      { id: 'document_15_application', name: 'Coach application declaration', type: 'APPLICATION_RECORD', status: 'RECEIVED', submittedAt: '2026-08-19T11:45:00.000Z', fileAvailable: false, description: 'Structured application data and accepted platform policies.' },
      { id: 'document_15_identity', name: 'Payment-provider identity check', type: 'PROVIDER_VERIFICATION', status: 'VERIFIED', submittedAt: '2026-08-19T11:29:00.000Z', fileAvailable: false, description: 'Verification result received from the payout provider. Tradigo does not store an ID image.' },
    ],
    languages: ['Arabic', 'English', 'French'],
    availability: 'Flexible · 4–5 sessions per week',
    compliance: {
      remoteControl: 'v1.0',
      credentials: 'v1.0',
      offPlatform: 'v1.0',
      jurisdiction: 'v1.0',
    },
    reviewFlags: [],
  },
];

const previewEarlierApplication = {
  id: 'application_14',
  display_name: 'Nadia Rahman',
  email: 'nadia@demo.tradigo.app',
  submitted_at: '2026-08-12T15:20:00.000Z',
  attemptNumber: 1,
  status: 'REJECTED',
  decided_by: 'moderator:review-18',
  decided_at: '2026-08-15T10:05:00.000Z',
  reviewerNote: 'Please add a clearer teaching sample and explain how you keep coaching within education-only boundaries.',
  profile: {
    headline: 'Price-action mentor',
    bio: 'I help traders review charts and improve their process.',
    teachingMethod: 'Screen-share chart review.',
    coachingBoundaries: 'Education only.',
    hourlyRateCents: 6800,
    languages: ['Arabic', 'English'],
  },
  markets: { markets: ['FOREX'], coachingSpecialties: ['TRADE_REVIEW'] },
  experience: { yearsExperience: 5, background: 'Five years of FX study and peer mentoring.' },
  verifications: { identity: 'VERIFIED', knowledge: 'PASSED', safety: 'PASSED' },
  assessmentAttempts: [
    { id: 'assessment_14_knowledge_1', type: 'KNOWLEDGE', status: 'PASSED', score: 8, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-12T14:30:00.000Z', reviewerNote: 'Passed, but the written teaching sample needed more detail.' },
    { id: 'assessment_14_safety_1', type: 'SAFETY', status: 'PASSED', score: 9, maxScore: 10, attemptNumber: 1, submittedAt: '2026-08-12T14:38:00.000Z' },
  ],
  documents: [
    { id: 'document_14_application', name: 'Coach application declaration', type: 'APPLICATION_RECORD', status: 'RECEIVED', submittedAt: '2026-08-12T15:20:00.000Z', fileAvailable: false },
  ],
  compliance: { remoteControl: 'v1.0', credentials: 'v1.0', offPlatform: '', jurisdiction: 'v1.0' },
  reviewFlags: ['Teaching sample was not sufficiently detailed.', 'Off-platform payment declaration was incomplete.'],
};

const previewCurrentApplication = previewApplications[0];
previewApplications[0] = {
  ...previewCurrentApplication,
  attemptNumber: 2,
  isResubmission: true,
  previousApplicationId: previewEarlierApplication.id,
  attemptHistory: [
    { ...previewCurrentApplication, attemptNumber: 2, isResubmission: true, previousApplicationId: previewEarlierApplication.id },
    previewEarlierApplication,
  ],
};

const labelize = (value: unknown) =>
  String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase());

const listValue = (value: unknown, fallback = 'Not provided') => {
  if (Array.isArray(value) && value.length > 0) return value.map(labelize).join(' · ');
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

const moneyValue = (cents: unknown) => {
  const amount = typeof cents === 'number' ? cents : Number(cents);
  return Number.isFinite(amount) ? `$${(amount / 100).toFixed(2)}` : 'Not provided';
};

const applicationProfile = (application: any) => application?.profile ?? {};
const applicationMarkets = (application: any) => application?.markets ?? {};
const applicationExperience = (application: any) => application?.experience ?? {};
const applicationVerifications = (application: any) => application?.verifications ?? {};
const applicationCompliance = (application: any) => application?.compliance ?? {};
const applicationAssessments = (application: any) => {
  const value = application?.assessmentAttempts ?? application?.assessment_attempts;
  return Array.isArray(value) ? value : [];
};
const applicationDocuments = (application: any) => {
  const value = application?.documents ?? application?.document_records;
  return Array.isArray(value) ? value : [];
};

const dateValue = (value: unknown) => value ? new Date(String(value)).toLocaleDateString() : 'Not recorded';
const dateTimeValue = (value: unknown) => value ? new Date(String(value)).toLocaleString() : 'Not recorded';

const evidenceStatusClass = (value: unknown) => {
  const status = String(value ?? '').toUpperCase();
  if (status === 'PASSED' || status === 'VERIFIED' || status === 'RECEIVED' || status === 'COMPLETE' || status === 'PASS') {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (status === 'REJECTED' || status === 'FAILED' || status === 'DECLINED' || status === 'FAIL') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

const attemptHistoryFor = (application: any, applications: any[]) => {
  if (Array.isArray(application?.attemptHistory) && application.attemptHistory.length > 0) {
    return application.attemptHistory;
  }

  const history = application ? [application] : [];
  const visited = new Set(history.map(item => item.id));
  let previousId = application?.previousApplicationId;
  while (previousId && !visited.has(previousId)) {
    const previous = applications.find(item => item.id === previousId);
    if (!previous) break;
    history.push(previous);
    visited.add(previous.id);
    previousId = previous.previousApplicationId;
  }
  return history;
};

type ComparisonState = 'unchanged' | 'added' | 'removed' | 'changed';

const hasComparisonValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const comparisonSnapshot = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(comparisonSnapshot).sort().join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${comparisonSnapshot(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

const comparisonState = (currentValue: unknown, earlierValue: unknown): ComparisonState => {
  const currentPresent = hasComparisonValue(currentValue);
  const earlierPresent = hasComparisonValue(earlierValue);
  if (!currentPresent && !earlierPresent) return 'unchanged';
  if (currentPresent && !earlierPresent) return 'added';
  if (!currentPresent && earlierPresent) return 'removed';
  return comparisonSnapshot(currentValue) === comparisonSnapshot(earlierValue) ? 'unchanged' : 'changed';
};

const comparisonFieldClass = (state: ComparisonState) => {
  if (state === 'added') return 'border-emerald-300 bg-emerald-50/70';
  if (state === 'removed') return 'border-red-300 bg-red-50/70';
  if (state === 'changed') return 'border-amber-300 bg-amber-50/70';
  return 'border-border bg-background/60';
};

const comparisonMarker = (state: ComparisonState, isCurrent: boolean) => {
  if (state === 'unchanged') return null;
  if (state === 'added') return isCurrent ? 'New in this attempt' : 'Missing prior evidence';
  if (state === 'removed') return isCurrent ? 'Removed in this attempt' : 'Present in prior attempt';
  return 'Changed';
};

const formatComparisonValue = (value: unknown, key = ''): string => {
  if (key.endsWith('Cents')) return moneyValue(value);
  if (Array.isArray(value)) return listValue(value);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => `${labelize(entryKey)}: ${formatComparisonValue(entryValue, entryKey)}`)
      .join(' · ') || 'Not provided';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return hasComparisonValue(value) ? String(value) : 'Not provided';
};

const comparisonFieldNames = (
  currentSection: Record<string, unknown>,
  earlierSection: Record<string, unknown>,
  preferred: string[],
) => [...new Set([...preferred, ...Object.keys(currentSection), ...Object.keys(earlierSection)])];

const assessmentKey = (assessment: any, index: number) =>
  `${assessment?.type || 'ASSESSMENT'}:${assessment?.attemptNumber ?? index + 1}`;

const collectionByKey = (items: any[], keyFor: (item: any, index: number) => string) => {
  const entries = new Map<string, any>();
  items.forEach((item, index) => entries.set(keyFor(item, index), item));
  return entries;
};

const assessmentComparableValue = (assessment: any) => assessment && ({
  type: assessment.type,
  status: assessment.status,
  score: assessment.score,
  maxScore: assessment.maxScore,
  version: assessment.version,
  answersReviewed: assessment.answersReviewed,
  reviewerNote: assessment.reviewerNote,
  answers: Array.isArray(assessment.answers)
    ? assessment.answers.map((answer: any) => ({
      questionId: answer.questionId,
      questionText: answer.questionText,
      answer: answer.answer,
      isCorrect: answer.isCorrect,
    }))
    : [],
});

const assessmentDisplayValue = (assessment: any) => {
  if (!assessment) return 'No assessment attempt recorded';
  const answers = Array.isArray(assessment.answers) ? ` · ${assessment.answers.length} responses` : '';
  return `${labelize(assessment.type || 'Assessment')} ${assessment.score ?? '—'}/${assessment.maxScore ?? '—'} · ${labelize(assessment.status || 'NOT_RECORDED')}${answers}`;
};

const documentKey = (document: any, _index: number) => {
  const type = document?.type || document?.document_type || 'DOCUMENT';
  return `${type}:${document?.name || 'unnamed'}`;
};

const documentComparableValue = (document: any) => document && ({
  type: document.type,
  name: document.name,
  description: document.description,
  issuer: document.issuer,
  status: document.status,
  fileAvailable: document.fileAvailable,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
});

const documentDisplayValue = (document: any) => {
  if (!document) return 'No document record';
  return document.name || 'Unnamed document';
};

const ComparisonField = ({
  label,
  currentValue,
  earlierValue,
  isCurrent,
  valueKey = '',
  formatValue = (value: unknown) => formatComparisonValue(value, valueKey),
}: {
  label: string;
  currentValue: unknown;
  earlierValue: unknown;
  isCurrent: boolean;
  valueKey?: string;
  formatValue?: (value: unknown) => string;
}) => {
  const state = comparisonState(currentValue, earlierValue);
  const value = isCurrent ? currentValue : earlierValue;
  const marker = comparisonMarker(state, isCurrent);
  return (
    <div className={`rounded-md border p-3 ${comparisonFieldClass(state)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {marker && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            state === 'added' ? 'bg-emerald-100 text-emerald-800'
              : state === 'removed' ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
          }`}>
            {marker}
          </span>
        )}
      </div>
      <p className={`mt-1 break-words text-sm leading-5 ${state === 'unchanged' ? 'text-foreground' : 'font-semibold text-foreground'}`}>
        {formatValue(value)}
      </p>
    </div>
  );
};

const AttemptComparisonCard = ({
  application,
  label,
  isCurrent,
  compareTo,
  onOpen,
}: {
  application: any;
  label: string;
  isCurrent: boolean;
  compareTo?: any;
  onOpen?: () => void;
}) => {
  const comparisonApplication = compareTo ?? {};
  const currentApplication = isCurrent ? application : comparisonApplication;
  const earlierApplication = isCurrent ? comparisonApplication : application;
  const currentProfile = applicationProfile(currentApplication);
  const earlierProfile = applicationProfile(earlierApplication);
  const currentMarkets = applicationMarkets(currentApplication);
  const earlierMarkets = applicationMarkets(earlierApplication);
  const currentExperience = applicationExperience(currentApplication);
  const earlierExperience = applicationExperience(earlierApplication);
  const currentCompliance = applicationCompliance(currentApplication);
  const earlierCompliance = applicationCompliance(earlierApplication);
  const currentAssessments = applicationAssessments(currentApplication);
  const earlierAssessments = applicationAssessments(earlierApplication);
  const currentDocuments = applicationDocuments(currentApplication);
  const earlierDocuments = applicationDocuments(earlierApplication);
  const profileFields = [
    ['Headline', 'headline'],
    ['Bio', 'bio'],
    ['Teaching method', 'teachingMethod'],
    ['Coaching boundaries', 'coachingBoundaries'],
    ['Languages', 'languages'],
    ['Hourly rate', 'hourlyRateCents'],
    ['Instant rate', 'instantRatePerMinuteCents'],
  ];
  const experienceFields = comparisonFieldNames(
    currentExperience,
    earlierExperience,
    ['yearsExperience', 'background', 'teachingExperience', 'availability', 'representativeWork'],
  );
  const marketFields = comparisonFieldNames(
    currentMarkets,
    earlierMarkets,
    ['markets', 'instruments', 'tradingStyles', 'methodologies', 'coachingSpecialties'],
  );
  const complianceFields = comparisonFieldNames(
    currentCompliance,
    earlierCompliance,
    ['remoteControl', 'credentials', 'offPlatform', 'jurisdiction'],
  );
  const currentAssessmentMap = collectionByKey(currentAssessments, assessmentKey);
  const earlierAssessmentMap = collectionByKey(earlierAssessments, assessmentKey);
  const assessmentKeys = [...new Set([...currentAssessmentMap.keys(), ...earlierAssessmentMap.keys()])];
  const currentDocumentMap = collectionByKey(currentDocuments, documentKey);
  const earlierDocumentMap = collectionByKey(earlierDocuments, documentKey);
  const documentKeys = [...new Set([...currentDocumentMap.keys(), ...earlierDocumentMap.keys()])];
  const cardAssessments = isCurrent ? currentAssessments : earlierAssessments;
  const cardDocuments = isCurrent ? currentDocuments : earlierDocuments;
  const cardCompliance = isCurrent ? currentCompliance : earlierCompliance;

  return (
    <div className={`rounded-lg border p-4 ${isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/30'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 font-semibold text-foreground">Attempt {application.attemptNumber ?? 1}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {dateValue(application.submittedAt ?? application.submitted_at)}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${evidenceStatusClass(application.status)}`}>
          {labelize(application.status || 'NOT_RECORDED')}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision feedback</p>
          <p className="mt-1 leading-5 text-foreground">{application.reviewerNote || 'No reviewer feedback recorded.'}</p>
          {application.decidedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {labelize(application.decidedBy ? `Decided by ${application.decidedBy}` : 'Decision recorded')} · {dateTimeValue(application.decidedAt)}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {profileFields.map(([fieldLabel, fieldKey]) => (
              <ComparisonField
                key={fieldKey}
                label={fieldLabel}
                currentValue={currentProfile[fieldKey]}
                earlierValue={earlierProfile[fieldKey]}
                isCurrent={isCurrent}
                valueKey={fieldKey}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experience</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {experienceFields.map(fieldKey => (
              <ComparisonField
                key={fieldKey}
                label={labelize(fieldKey)}
                currentValue={currentExperience[fieldKey]}
                earlierValue={earlierExperience[fieldKey]}
                isCurrent={isCurrent}
                valueKey={fieldKey}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Markets and coaching scope</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {marketFields.map(fieldKey => (
              <ComparisonField
                key={fieldKey}
                label={labelize(fieldKey)}
                currentValue={currentMarkets[fieldKey]}
                earlierValue={earlierMarkets[fieldKey]}
                isCurrent={isCurrent}
                valueKey={fieldKey}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compliance declarations</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {complianceFields.map(fieldKey => (
              <ComparisonField
                key={fieldKey}
                label={labelize(fieldKey)}
                currentValue={currentCompliance[fieldKey]}
                earlierValue={earlierCompliance[fieldKey]}
                isCurrent={isCurrent}
                valueKey={fieldKey}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Documents', cardDocuments.length],
            ['Assessments', cardAssessments.length],
            ['Declarations', Object.values(cardCompliance).filter(Boolean).length],
          ].map(([name, value]) => (
            <div key={name} className="rounded-md bg-background/80 p-2 text-center">
              <p className="font-bold text-foreground">{value}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment attempts</p>
          <div className="space-y-2">
            {assessmentKeys.length > 0 ? assessmentKeys.map(key => (
              <ComparisonField
                key={key}
                label={labelize(key.replace(/:\d+$/, ''))}
                currentValue={assessmentComparableValue(currentAssessmentMap.get(key))}
                earlierValue={assessmentComparableValue(earlierAssessmentMap.get(key))}
                isCurrent={isCurrent}
                formatValue={value => assessmentDisplayValue(value)}
              />
            )) : (
              <p className="rounded-md border border-dashed border-border bg-background/60 p-3 text-xs text-muted-foreground">No assessment attempt recorded.</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supporting documents</p>
          <div className="space-y-2">
            {documentKeys.length > 0 ? documentKeys.map(key => (
              <ComparisonField
                key={key}
                label={labelize(key.replace(/:\d+$/, ''))}
                currentValue={documentComparableValue(currentDocumentMap.get(key))}
                earlierValue={documentComparableValue(earlierDocumentMap.get(key))}
                isCurrent={isCurrent}
                formatValue={value => documentDisplayValue(value)}
              />
            )) : (
              <p className="rounded-md border border-dashed border-border bg-background/60 p-3 text-xs text-muted-foreground">No supporting document record.</p>
            )}
          </div>
        </div>
        {!isCurrent && onOpen && (
          <Button variant="outline" className="w-full" onClick={onOpen}>
            Open earlier application
          </Button>
        )}
      </div>
    </div>
  );
};

export const AdminApplications = ({ demoMode = false }: { demoMode?: boolean }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestedApplicationId = new URLSearchParams(window.location.search).get('applicationId');
  const [reviewChecksState, setReviewChecksState] = useState<Record<ReviewCheckKey, boolean>>({
    profile: false,
    experience: false,
    knowledge: false,
    safety: false,
    compliance: false,
  });
  const [decisionError, setDecisionError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [documentViewer, setDocumentViewer] = useState<{ document: any; url: string; revoke: boolean } | null>(null);
  const [identityEvents, setIdentityEvents] = useState<any[]>([]);
  const [identityEventTargets, setIdentityEventTargets] = useState<Record<string, string>>({});
  const [identityEventAction, setIdentityEventAction] = useState<string | null>(null);
  const [identityEventMessage, setIdentityEventMessage] = useState('');
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [clarificationDrafts, setClarificationDrafts] = useState<Record<string, string>>({});
  const [clarificationSaving, setClarificationSaving] = useState<string | null>(null);
  const [clarificationError, setClarificationError] = useState('');

  useEffect(() => {
    if (demoMode) {
      setApplications(previewApplications);
      setIdentityEvents([]);
      setLoading(false);
      return;
    }
    fetchApplications();
    fetchIdentityEvents();
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void fetchApplications();
        void fetchIdentityEvents();
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [demoMode]);

  useEffect(() => {
    if (!selectedId && applications[0]) setSelectedId(applications[0].id);
  }, [applications, selectedId]);

  useEffect(() => {
    if (requestedApplicationId && applications.some(application => application.id === requestedApplicationId)) {
      setSelectedId(requestedApplicationId);
    }
  }, [applications, requestedApplicationId]);

  useEffect(() => {
    setReviewChecksState({
      profile: false,
      experience: false,
      knowledge: false,
      safety: false,
      compliance: false,
    });
    setDecisionError('');
    setComparisonId(null);
    setClarificationError('');
    setClarificationDrafts({});
  }, [selectedId]);

  const selectedApplication = useMemo(
    () => applications.find(application => application.id === selectedId) ?? null,
    [applications, selectedId],
  );
  const selectedAttemptHistory = useMemo(
    () => attemptHistoryFor(selectedApplication, applications),
    [applications, selectedApplication],
  );
  const comparisonApplication = useMemo(
    () => selectedAttemptHistory.find((application: any) => application.id === comparisonId) ?? null,
    [comparisonId, selectedAttemptHistory],
  );
  const previousApplication = useMemo(
    () => selectedAttemptHistory.find((application: any) => application.id === selectedApplication?.previousApplicationId)
      ?? selectedAttemptHistory.find((application: any) => application.id !== selectedApplication?.id)
      ?? null,
    [selectedApplication, selectedAttemptHistory],
  );
  const selectedClarifications = useMemo(
    () => selectedAttemptHistory
      .flatMap((application: any) => (Array.isArray(application.clarificationRequests)
        ? application.clarificationRequests.map((request: any) => ({
          ...request,
          attemptNumber: application.attemptNumber,
          applicationAttemptState: application.status,
        }))
        : [])),
    [selectedAttemptHistory],
  );

  const selectedProfile = applicationProfile(selectedApplication);
  const selectedMarkets = applicationMarkets(selectedApplication);
  const selectedExperience = applicationExperience(selectedApplication);
  const selectedVerifications = applicationVerifications(selectedApplication);
  const selectedCompliance = applicationCompliance(selectedApplication);
  const selectedAssessments = applicationAssessments(selectedApplication);
  const selectedDocuments = applicationDocuments(selectedApplication);
  const providerReviewStatus = String(
    selectedVerifications.providerReviewStatus
      ?? (selectedVerifications.hostedReviewUrl ? 'AVAILABLE' : selectedVerifications.providerReference ? 'REFERENCE_ONLY' : 'UNAVAILABLE'),
  ).toUpperCase();
  const providerReviewUrl = typeof selectedVerifications.hostedReviewUrl === 'string' ? selectedVerifications.hostedReviewUrl : '';
  const providerReference = typeof selectedVerifications.providerReference === 'string' ? selectedVerifications.providerReference : '';
  const identityDecision = selectedVerifications.identityDecision ?? {};
  const identityHistory = Array.isArray(selectedVerifications.identityHistory) ? selectedVerifications.identityHistory : [];
  const canApprove = reviewChecks.every(check => reviewChecksState[check.key]);

  const fetchApplications = async () => {
    if (!demoMode) setRefreshing(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/applications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data) ? data : data.applications ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchIdentityEvents = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/admin/identity-webhook-events', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIdentityEvents(Array.isArray(data.events) ? data.events : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleIdentityEventAction = async (event: any, action: 'link' | 'retry') => {
    if (demoMode) return;
    const applicationId = identityEventTargets[event.id] || event.applicationId || '';
    if (action === 'link' && !applicationId) {
      setIdentityEventMessage('Choose the correct coach application before linking this callback.');
      return;
    }
    if (action === 'retry' && !window.confirm(`Retry identity callback ${event.eventId}? The provider event will be applied at most once.`)) return;
    setIdentityEventAction(`${action}:${event.id}`);
    setIdentityEventMessage('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/identity-webhook-events/${encodeURIComponent(event.id)}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...(action === 'link' ? { body: JSON.stringify({ applicationId }) } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Unable to recover this identity callback.');
      setIdentityEventMessage(action === 'link'
        ? 'Identity callback linked. Retry it when the application reference is confirmed.'
        : data.idempotent
          ? 'This identity callback was already processed safely.'
          : 'Identity callback reprocessed and recorded.');
      await Promise.all([fetchApplications(), fetchIdentityEvents()]);
    } catch (err) {
      setIdentityEventMessage(err instanceof Error ? err.message : 'Unable to recover this identity callback.');
      await fetchIdentityEvents();
    } finally {
      setIdentityEventAction(null);
    }
  };

  const openDocument = async (document: any) => {
    if (document.previewUrl) {
      setDocumentViewer({ document, url: document.previewUrl, revoke: false });
      return;
    }
    if (!document.objectPath) {
      setDecisionError('This record has no Tradigo file. Provider identity records expose status only; application declarations are metadata-only.');
      return;
    }
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/storage${document.objectPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Document access was denied.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDocumentViewer({ document, url, revoke: true });
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : 'Unable to open this document.');
    }
  };

  const closeDocumentViewer = () => {
    if (documentViewer?.revoke) URL.revokeObjectURL(documentViewer.url);
    setDocumentViewer(null);
  };

  const handleDecision = async (application: any, decision: ApplicationDecision) => {
    if (decision === 'APPROVE' && !canApprove) {
      setDecisionError('Complete every review check before approving this coach.');
      return;
    }

    const reason = window.prompt(
      decision === 'APPROVE'
        ? 'Approval note (what evidence supported this decision)?'
        : 'Reason for rejection?',
    );
    if (!reason?.trim()) return;

    if (demoMode) {
      setApplications(current =>
        current.map(candidate =>
          candidate.id === application.id
            ? { ...candidate, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewer_note: reason.trim() }
            : candidate,
        ),
      );
      setDecisionError('');
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/admin/applications/${application.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, reason: reason.trim(), reviewChecklist: reviewChecksState }),
      });
      if (res.ok) {
        await fetchApplications();
      } else {
        const err = await res.json();
        setDecisionError(err.message || 'Unable to save the application decision.');
      }
    } catch (err) {
      setDecisionError('Unable to save the application decision. Please try again.');
    }
  };

  const handleClarificationUpdate = async (request: any, status: 'ANSWERED' | 'CLOSED') => {
    if (demoMode) return;
    const responseText = (clarificationDrafts[request.id] ?? '').trim();
    if (status === 'ANSWERED' && responseText.length < 2) {
      setClarificationError('Add a response before marking the clarification answered.');
      return;
    }
    setClarificationSaving(request.id);
    setClarificationError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/admin/application-clarifications/${request.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, response: responseText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'Unable to update this clarification request.');
      trackEvent('clarification_request_resolved', {
        surface: 'admin_applications',
        application_attempt_state: request.applicationAttemptState ?? 'UNKNOWN',
        outcome: status === 'ANSWERED' ? 'answered' : 'closed',
      });
      await fetchApplications();
    } catch (error) {
      setClarificationError(error instanceof Error ? error.message : 'Unable to update this clarification request.');
    } finally {
      setClarificationSaving(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading coach applications...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coach Applications</h1>
          <p className="mt-1 text-muted-foreground">
            Review the person, teaching scope, assessments, and safeguards before approving marketplace access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!demoMode && (
            <Button variant="outline" onClick={() => fetchApplications()} disabled={refreshing} aria-label="Refresh coach applications">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}
          {demoMode && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Preview data · no production actions
            </span>
          )}
        </div>
      </div>

      <AssessmentQuestionBank demoMode={demoMode} />

      {!demoMode && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-semibold text-foreground">Identity callback recovery</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Signed provider events that could not be matched are retained as normalized records. Raw provider payloads are never shown here.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
              {identityEvents.filter(event => event.status !== 'PROCESSED').length} needs attention
            </span>
          </div>
          {identityEventMessage && (
            <p role="status" className="mt-4 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm text-foreground">
              {identityEventMessage}
            </p>
          )}
          {identityEvents.length > 0 ? (
            <div className="mt-4 space-y-3">
              {identityEvents.map(event => {
                const linkedApplication = applications.some(application => application.id === event.applicationId);
                const target = identityEventTargets[event.id] ?? (linkedApplication ? event.applicationId : '');
                const busy = identityEventAction?.endsWith(`:${event.id}`);
                return (
                  <div key={event.id} className="rounded-lg border border-amber-200 bg-background p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${evidenceStatusClass(event.status)}`}>
                            {labelize(event.status)}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${evidenceStatusClass(event.decision)}`}>
                            {labelize(event.decision)}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">{event.provider}</span>
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-foreground">Event {event.eventId}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Received {dateTimeValue(event.receivedAt)} · Attempts {event.attemptCount ?? 0}
                          {event.providerReference ? ` · Provider reference ${event.providerReference}` : ''}
                        </p>
                        {event.error && <p className="mt-2 text-sm text-amber-900">{event.error}</p>}
                      </div>
                      {event.status !== 'PROCESSED' && (
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[250px]">
                          <label className="text-xs font-semibold text-foreground" htmlFor={`identity-target-${event.id}`}>
                            Link to coach application
                          </label>
                          <select
                            id={`identity-target-${event.id}`}
                            value={target}
                            onChange={change => setIdentityEventTargets(current => ({ ...current, [event.id]: change.target.value }))}
                            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                          >
                            <option value="">Choose an application…</option>
                            {applications.map(application => (
                              <option key={application.id} value={application.id}>
                                {application.display_name || application.displayName || application.applicantName || application.id}
                              </option>
                            ))}
                          </select>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleIdentityEventAction(event, 'link')}
                              disabled={Boolean(busy) || !target}
                              aria-label={`Link identity callback ${event.eventId}`}
                            >
                              <Link2 className="mr-2 h-4 w-4" /> Link
                            </Button>
                            <Button
                              onClick={() => handleIdentityEventAction(event, 'retry')}
                              disabled={Boolean(busy) || (!event.applicationId && !event.providerReference)}
                              aria-label={`Retry identity callback ${event.eventId}`}
                            >
                              <RefreshCw className={`mr-2 h-4 w-4 ${identityEventAction === `retry:${event.id}` ? 'animate-spin' : ''}`} /> Retry
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-amber-300 bg-background/70 p-4 text-sm text-muted-foreground">
              No identity callback recovery items are currently recorded.
            </p>
          )}
        </section>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(430px,0.95fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-secondary/30 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Applicants awaiting review</h2>
                <p className="mt-1 text-xs text-muted-foreground">{applications.length} applications in the review register</p>
              </div>
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="divide-y divide-border">
            {applications.map(application => {
              const isSelected = application.id === selectedId;
              const profile = applicationProfile(application);
              const markets = applicationMarkets(application);
              return (
                <button
                  type="button"
                  key={application.id}
                  onClick={() => setSelectedId(application.id)}
                  className={`w-full px-5 py-4 text-left transition-colors hover:bg-accent/40 ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/30' : ''}`}
                  aria-pressed={isSelected}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{application.display_name || application.displayName || 'Unnamed applicant'}</span>
                        {isSelected && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Reviewing</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{application.email}</p>
                      {application.attemptNumber > 1 && (
                        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                          <History className="h-3.5 w-3.5" />
                          Attempt {application.attemptNumber} · resubmission with an earlier application linked
                        </p>
                      )}
                      <p className="mt-3 truncate text-sm text-foreground">{profile.headline || application.headline || 'Coach profile headline not provided'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{listValue(markets.coachingSpecialties ?? application.specialties)}</p>
                    </div>
                    <div className="flex shrink-0 flex-row items-center gap-3 text-xs lg:flex-col lg:items-end">
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${
                        application.status === 'UNDER_REVIEW'
                          ? 'bg-amber-100 text-amber-800'
                          : application.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {labelize(application.status)}
                      </span>
                      <span className="text-muted-foreground">{application.years_experience ?? application.experience?.yearsExperience ?? '—'} years</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {applications.length === 0 && (
              <div className="px-6 py-12 text-center text-muted-foreground">No coach applications found.</div>
            )}
          </div>
        </section>

        {selectedApplication ? (
          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-foreground">{selectedApplication.display_name || selectedApplication.displayName}</h2>
                    <p className="truncate text-sm text-muted-foreground">{selectedApplication.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted {new Date(selectedApplication.submitted_at || selectedApplication.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                  {labelize(selectedApplication.status)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Experience', `${selectedExperience.yearsExperience ?? selectedApplication.years_experience ?? '—'} yrs`],
                  ['Hourly rate', moneyValue(selectedProfile.hourlyRateCents ?? selectedApplication.hourly_rate_cents)],
                  ['Markets', listValue(selectedMarkets.markets ?? selectedApplication.markets, '—')],
                  ['Identity', labelize(selectedVerifications.identity || 'NOT_REVIEWED')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            {previousApplication && (
              <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm" aria-labelledby="application-history-heading">
                <div className="flex items-start gap-3">
                  <History className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 id="application-history-heading" className="font-semibold text-foreground">
                          Resubmission history
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          This is attempt {selectedApplication.attemptNumber ?? 1}. The earlier application remains unchanged and is available for read-only comparison.
                        </p>
                      </div>
                      <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-bold text-primary">
                        {selectedAttemptHistory.length} linked attempts
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-background/70 p-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Earlier attempt {previousApplication.attemptNumber ?? 1} · {labelize(previousApplication.status || 'NOT_RECORDED')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted {dateValue(previousApplication.submittedAt ?? previousApplication.submitted_at)}
                          {previousApplication.reviewerNote ? ' · Feedback is recorded' : ' · No feedback recorded'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setComparisonId(comparisonApplication ? null : previousApplication.id)}
                        aria-expanded={Boolean(comparisonApplication)}
                        aria-controls="application-attempt-comparison"
                      >
                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                        {comparisonApplication ? 'Hide comparison' : 'Compare attempts'}
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {comparisonApplication && (
              <section id="application-attempt-comparison" className="rounded-xl border border-border bg-card p-5 shadow-sm" aria-labelledby="application-attempt-comparison-heading">
                <div className="flex items-start gap-3">
                  <ArrowLeftRight className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 id="application-attempt-comparison-heading" className="font-semibold text-foreground">Compare application attempts</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Review the earlier decision, feedback, and evidence next to the current submission. Both records are read-only.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <AttemptComparisonCard
                    application={selectedApplication}
                    label="Current submission"
                    isCurrent
                    compareTo={comparisonApplication}
                  />
                  <AttemptComparisonCard
                    application={comparisonApplication}
                    label="Earlier application"
                    isCurrent={false}
                    compareTo={selectedApplication}
                    onOpen={() => setSelectedId(comparisonApplication.id)}
                  />
                </div>
              </section>
            )}

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Application evidence</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Everything an administrator needs to make a documented approval decision.</p>
                </div>
                <ClipboardCheck className="h-5 w-5 shrink-0 text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ['Documents', selectedDocuments.length],
                  ['Assessments', selectedAssessments.length],
                  ['Declarations', Object.values(selectedCompliance).filter(Boolean).length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-background/80 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <a href="#admin-assessments" className="rounded-lg border border-border bg-background/70 p-3 text-left transition-colors hover:border-primary/50">
                  <p className="text-xs font-semibold text-foreground">Assessments taken</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedAssessments.length ? `${selectedAssessments.length} recorded attempt${selectedAssessments.length === 1 ? '' : 's'}` : 'No attempts recorded'}</p>
                  <p className="mt-2 text-xs font-semibold text-primary">View answers →</p>
                </a>
                <a href="#admin-documents" className="rounded-lg border border-border bg-background/70 p-3 text-left transition-colors hover:border-primary/50">
                  <p className="text-xs font-semibold text-foreground">Documents</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedDocuments.length ? `${selectedDocuments.length} document record${selectedDocuments.length === 1 ? '' : 's'}` : 'No documents recorded'}</p>
                  <p className="mt-2 text-xs font-semibold text-primary">View evidence →</p>
                </a>
                <a href="#admin-verification" className="rounded-lg border border-border bg-background/70 p-3 text-left transition-colors hover:border-primary/50">
                  <p className="text-xs font-semibold text-foreground">Identity check</p>
                  <p className="mt-1 text-xs text-muted-foreground">Provider-hosted verification</p>
                  <p className="mt-2 text-xs font-semibold text-primary">View status →</p>
                </a>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-foreground">Recorded assessment results</p>
                  <p className="mt-1 text-muted-foreground">{selectedAssessments.map((assessment: any) => `${labelize(assessment.type)} ${assessment.score ?? '—'}/${assessment.maxScore ?? '—'}`).join(' · ') || 'None recorded'}</p>
                  <p className="mt-1 text-muted-foreground">Questions are written by Tradigo; the coach submits the answers.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Recorded documents</p>
                  <p className="mt-1 text-muted-foreground">{selectedDocuments.map((document: any) => document.name).join(' · ') || 'None recorded'}</p>
                  <p className="mt-1 text-muted-foreground">Identity is provider-hosted; no raw ID image is stored here.</p>
                </div>
              </div>
            </section>

            <section id="admin-assessments" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Assessments taken</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Submitted attempts, scores, versions, and reviewer notes.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedAssessments.length > 0 ? selectedAssessments.map((assessment: any) => {
                  const answerCount = assessment.answersReviewed ?? (Array.isArray(assessment.answers) ? assessment.answers.length : null);
                  const score = assessment.score !== undefined && assessment.maxScore !== undefined
                    ? `${assessment.score}/${assessment.maxScore}`
                    : 'Score not recorded';
                  return (
                    <div key={assessment.id || `${assessment.type}-${assessment.attemptNumber}`} className="rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{labelize(assessment.type)} assessment</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Attempt {assessment.attemptNumber ?? 1} · Submitted {dateValue(assessment.submittedAt ?? assessment.submitted_at)} · Version {assessment.version || 'Not recorded'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${evidenceStatusClass(assessment.status)}`}>{labelize(assessment.status || 'NOT_RECORDED')}</span>
                          <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-foreground">{score}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <p className="text-muted-foreground"><span className="font-semibold text-foreground">Responses reviewed:</span> {answerCount ?? 'Not recorded'}</p>
                        <p className="text-muted-foreground"><span className="font-semibold text-foreground">Completed:</span> {dateValue(assessment.completedAt ?? assessment.completed_at ?? assessment.submittedAt ?? assessment.submitted_at)}</p>
                      </div>
                      {assessment.reviewerNote && <p className="mt-3 border-t border-border pt-3 text-sm leading-5 text-muted-foreground">{assessment.reviewerNote}</p>}
                      {Array.isArray(assessment.answers) && assessment.answers.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted answers</p>
                          {assessment.answers.map((answer: any, answerIndex: number) => (
                            <div key={answer.id || answer.questionId || answerIndex} className="rounded-md bg-background p-2.5 text-xs">
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-muted-foreground">Question {answerIndex + 1}</span>
                                <span className={`font-semibold ${answer.isCorrect ? 'text-emerald-700' : 'text-amber-700'}`}>{answer.isCorrect ? 'Correct' : 'Needs review'}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{answer.questionText || answer.questionId || 'Question text not recorded'}</p>
                              <p className="mt-1 text-sm text-foreground">{answer.answer || 'No answer text recorded'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    No assessment attempts were returned for this application.
                  </div>
                )}
              </div>
            </section>

            <section id="admin-documents" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Documents and declarations</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Document records and verification metadata, without exposing unnecessary ID images.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedDocuments.length > 0 ? selectedDocuments.map((document: any) => (
                  <div key={document.id || document.name} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{document.name || 'Untitled document'}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${evidenceStatusClass(document.status)}`}>{labelize(document.status || 'NOT_RECORDED')}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{labelize(document.type || 'DOCUMENT')} · Submitted {dateValue(document.submittedAt ?? document.submitted_at)}</p>
                      <p className="mt-2 text-sm leading-5 text-muted-foreground">{document.description || 'No document description provided.'}</p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {document.fileAvailable ? 'Private file available to an authorized reviewer.' : document.type === 'PROVIDER_VERIFICATION' ? 'Provider-hosted status record · no raw ID image is stored in Tradigo.' : 'Metadata record only · no file is stored in Tradigo.'}
                      </p>
                      {document.fileAvailable && (document.objectPath || document.previewUrl) && (
                        <button type="button" onClick={() => openDocument(document)} className="mt-3 text-sm font-semibold text-primary underline underline-offset-2">
                          {document.previewUrl ? 'Preview sample document' : 'Open supporting document'}
                        </button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    No documents or declaration records were returned for this application.
                  </div>
                )}
              </div>
            </section>

            {selectedApplication.reviewFlags?.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <h3 className="font-semibold text-amber-950">Review flags</h3>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {selectedApplication.reviewFlags.map((flag: string) => <li key={flag}>• {flag}</li>)}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            <section id="admin-verification" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Teaching profile</h3>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Headline</p>
                  <p className="mt-1 font-medium text-foreground">{selectedProfile.headline || selectedApplication.headline || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bio and learner fit</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{selectedProfile.bio || selectedApplication.bio || 'Not provided'}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teaching method</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{selectedProfile.teachingMethod || selectedApplication.teaching_method || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coaching boundaries</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{selectedProfile.coachingBoundaries || selectedApplication.coaching_boundaries || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Experience and coaching scope</h3>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Background</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{selectedExperience.background || selectedApplication.experience_summary || 'Not provided'}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teaching experience</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{selectedExperience.teachingExperience || selectedApplication.teaching_experience || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Availability</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{selectedExperience.availability || selectedApplication.availability || 'Not provided'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Representative work</p>
                    <p className="mt-1 leading-5 text-muted-foreground">{selectedExperience.representativeWork || selectedApplication.representative_work || 'Not provided'}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instruments</p><p className="mt-1 text-foreground">{listValue(selectedMarkets.instruments ?? selectedApplication.instruments)}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trading styles</p><p className="mt-1 text-foreground">{listValue(selectedMarkets.tradingStyles ?? selectedApplication.trading_styles)}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Methodologies</p><p className="mt-1 text-foreground">{listValue(selectedMarkets.methodologies ?? selectedApplication.methodologies)}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialties</p><p className="mt-1 text-foreground">{listValue(selectedMarkets.coachingSpecialties ?? selectedApplication.specialties)}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Languages</p><p className="mt-1 text-foreground">{listValue(selectedProfile.languages ?? selectedApplication.languages)}</p></div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Verification and compliance evidence</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ['Identity verification', selectedVerifications.identity],
                  ['Knowledge assessment', selectedVerifications.knowledge],
                  ['Safety assessment', selectedVerifications.safety],
                  ['No remote account control', selectedCompliance.remoteControl],
                  ['No credential collection', selectedCompliance.credentials],
                  ['No off-platform payments', selectedCompliance.offPlatform],
                  ['Jurisdiction agreement', selectedCompliance.jurisdiction],
                ].map(([label, value]) => {
                  const complete = value === 'PASSED' || value === 'VERIFIED' || Boolean(value);
                  return (
                    <div key={label} className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3">
                      {complete ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <p className={`mt-1 text-sm font-semibold ${complete ? 'text-emerald-700' : 'text-amber-700'}`}>{labelize(value || 'NOT COMPLETED')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                Identity is checked by the payout provider. Tradigo stores the verification status and review metadata only; raw government ID images are not stored here.
              </p>
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Provider-hosted identity record</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedVerifications.provider || 'Payment provider'} review record for authorized moderators.
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${evidenceStatusClass(providerReviewStatus)}`}>
                    {labelize(providerReviewStatus)}
                  </span>
                </div>
                {providerReviewStatus === 'AVAILABLE' && providerReviewUrl ? (
                  <a
                    href={providerReviewUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Open provider verification record ↗
                  </a>
                ) : providerReviewStatus === 'EXPIRED' ? (
                  <p className="mt-3 text-sm leading-5 text-amber-800">
                    This provider review link has expired. Ask the payout provider to issue a fresh moderator link before relying on the record.
                  </p>
                ) : providerReviewStatus === 'REFERENCE_ONLY' ? (
                  <p className="mt-3 text-sm leading-5 text-amber-800">
                    No hosted link is available. Use the provider reference below in the payout provider dashboard.
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-5 text-amber-800">
                    The provider has not supplied a hosted review link or reference yet. Request a fresh verification record before approval.
                  </p>
                )}
                {providerReference && (
                  <p className="mt-3 break-all text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Provider reference:</span> {providerReference}
                  </p>
                )}
                {selectedVerifications.hostedReviewUrlExpiresAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Link expiry: {dateValue(selectedVerifications.hostedReviewUrlExpiresAt)}
                  </p>
                )}
                 {selectedVerifications.lastCheckedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last provider check: {dateValue(selectedVerifications.lastCheckedAt)}
                  </p>
                )}
                 <div className="mt-4 border-t border-border pt-4">
                   <div className="flex flex-wrap items-start justify-between gap-3">
                     <div>
                       <p className="text-sm font-semibold text-foreground">Identity decision accountability</p>
                       <p className="mt-1 text-xs leading-5 text-muted-foreground">This is the provider identity decision, not Tradigo’s separate marketplace approval.</p>
                     </div>
                     {identityDecision.decision && (
                       <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${evidenceStatusClass(identityDecision.decision)}`}>
                         {labelize(identityDecision.decision)}
                       </span>
                     )}
                   </div>
                   {identityDecision.decision ? (
                     <>
                       <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                         <div><p className="font-semibold text-foreground">Responsible party</p><p className="mt-1 text-muted-foreground">{identityDecision.responsibleParty || selectedVerifications.provider || 'Provider not recorded'}</p></div>
                         <div><p className="font-semibold text-foreground">Decision time</p><p className="mt-1 text-muted-foreground">{dateTimeValue(identityDecision.decidedAt)}</p></div>
                         <div><p className="font-semibold text-foreground">Recorded in Tradigo by</p><p className="mt-1 break-all text-muted-foreground">{identityDecision.recordedBy || 'Not recorded'}</p></div>
                         <div><p className="font-semibold text-foreground">Recorded at</p><p className="mt-1 text-muted-foreground">{dateTimeValue(identityDecision.recordedAt)}</p></div>
                       </div>
                       <div className="mt-3 rounded-lg bg-secondary/40 p-3 text-sm leading-5 text-muted-foreground">
                         <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Basis for decision</p>
                         <p className="mt-1">{identityDecision.basis || 'No written basis recorded.'}</p>
                       </div>
                       {identityDecision.checks && Object.keys(identityDecision.checks).length > 0 && (
                         <div className="mt-3 grid gap-2 sm:grid-cols-2">
                           {Object.entries(identityDecision.checks).map(([key, value]) => (
                             <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/70 px-3 py-2 text-xs">
                               <span className="text-muted-foreground">{labelize(key)}</span>
                               <span className={`rounded-full px-2 py-1 font-bold ${evidenceStatusClass(value)}`}>{labelize(value)}</span>
                             </div>
                           ))}
                         </div>
                       )}
                       {Array.isArray(identityDecision.reasonCodes) && identityDecision.reasonCodes.length > 0 && (
                         <div className="mt-3 flex flex-wrap gap-2">
                           {identityDecision.reasonCodes.map((code: string) => <span key={code} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{labelize(code)}</span>)}
                         </div>
                       )}
                       {identityDecision.source && (
                         <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                           <span>Source: <span className="font-semibold text-foreground">{labelize(identityDecision.source)}</span></span>
                           {identityDecision.providerEventId && <span>Event reference: <span className="font-mono font-semibold text-foreground">{identityDecision.providerEventId}</span></span>}
                         </div>
                       )}
                     </>
                   ) : (
                     <p className="mt-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                       No provider decision record has been captured yet. Do not treat the marketplace application decision as identity confirmation.
                     </p>
                   )}
                 </div>
                 <div className="mt-4 border-t border-border pt-4">
                   <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immutable identity review history</p>
                   {identityHistory.length > 0 ? (
                     <div className="mt-3 space-y-2">
                       {identityHistory.map((entry: any, index: number) => (
                         <div key={`${entry.createdAt}-${entry.actorId}-${index}`} className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                           <div className="flex flex-wrap items-center justify-between gap-2">
                             <span className={`rounded-full px-2 py-1 font-bold ${evidenceStatusClass(entry.decision)}`}>{labelize(entry.decision)}</span>
                             <span className="text-muted-foreground">{dateTimeValue(entry.createdAt)}</span>
                           </div>
                           <p className="mt-2 text-muted-foreground"><span className="font-semibold text-foreground">Responsible:</span> {entry.responsibleParty || entry.provider || 'Not recorded'} · <span className="font-semibold text-foreground">Recorded by:</span> {entry.actorId || 'Not recorded'}</p>
                           <p className="mt-1 leading-5 text-muted-foreground">{entry.basis || 'No decision basis recorded.'}</p>
                           <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Source:</span> {labelize(entry.source || 'UNKNOWN')}{entry.providerEventId ? ` · Event ${entry.providerEventId}` : ''}</p>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="mt-2 text-xs text-muted-foreground">No identity decision transitions have been recorded.</p>
                   )}
                 </div>
                 <div className="mt-4 border-t border-border pt-4">
                   <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Separate Tradigo marketplace decision</p>
                   <p className="mt-1 text-sm text-foreground">{labelize(selectedApplication.status)}</p>
                   <p className="mt-1 text-xs text-muted-foreground">Responsible: {selectedApplication.decidedBy || 'Pending moderator decision'} · Time: {dateTimeValue(selectedApplication.decidedAt)}</p>
                   {selectedApplication.reviewerNote && <p className="mt-2 text-xs leading-5 text-muted-foreground">Basis: {selectedApplication.reviewerNote}</p>}
                 </div>
              </div>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Applicant clarification requests</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Respond to questions about shared feedback without exposing moderator-only investigation details.
                  </p>
                </div>
              </div>
              {selectedClarifications.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {selectedClarifications.map((request: any) => (
                    <div key={request.id} className="rounded-lg border border-border bg-background p-3" data-testid={`admin-clarification-${request.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${request.status === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800' : request.status === 'CLOSED' ? 'bg-secondary text-muted-foreground' : 'bg-amber-100 text-amber-800'}`}>
                            {labelize(request.status)}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">Attempt {request.attemptNumber}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{dateTimeValue(request.submittedAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-foreground">{request.message}</p>
                      {request.status === 'ANSWERED' && request.response && (
                        <p className="mt-2 border-t border-border pt-2 text-sm leading-5 text-muted-foreground">
                          <span className="font-semibold text-foreground">Response:</span> {request.response}
                        </p>
                      )}
                      {request.status === 'SUBMITTED' && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <label htmlFor={`admin-clarification-response-${request.id}`} className="text-xs font-semibold text-foreground">Response to applicant</label>
                          <textarea
                            id={`admin-clarification-response-${request.id}`}
                            value={clarificationDrafts[request.id] ?? ''}
                            onChange={event => setClarificationDrafts(current => ({ ...current, [request.id]: event.target.value }))}
                            maxLength={4000}
                            rows={3}
                            placeholder="Answer the question using only feedback that is safe to share with the applicant."
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm leading-5 text-foreground outline-none focus:ring-2 focus:ring-primary"
                            disabled={clarificationSaving === request.id}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void handleClarificationUpdate(request, 'ANSWERED')} disabled={clarificationSaving === request.id}>
                              {clarificationSaving === request.id ? 'Saving…' : 'Send response'}
                            </Button>
                            <Button variant="outline" onClick={() => void handleClarificationUpdate(request, 'CLOSED')} disabled={clarificationSaving === request.id}>
                              Close without response
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border bg-background/70 p-3 text-sm text-muted-foreground">
                  No clarification requests have been submitted for this application history.
                </p>
              )}
              {clarificationError && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{clarificationError}</p>}
            </section>

            {selectedApplication.status === 'UNDER_REVIEW' && (
              <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">Reviewer decision checklist</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Approval is enabled only after each evidence category has been reviewed.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {reviewChecks.map(check => (
                    <label key={check.key} className="flex cursor-pointer items-center gap-3 rounded-lg bg-background/70 p-3 text-sm text-foreground">
                      <input
                        type="checkbox"
                        checked={reviewChecksState[check.key]}
                        onChange={event => setReviewChecksState(current => ({ ...current, [check.key]: event.target.checked }))}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      {check.label}
                    </label>
                  ))}
                </div>
                {decisionError && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{decisionError}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => handleDecision(selectedApplication, 'APPROVE')} disabled={!canApprove}>
                    <Check className="mr-2 h-4 w-4" /> Approve coach
                  </Button>
                  <Button variant="outline" onClick={() => handleDecision(selectedApplication, 'REJECT')}>
                    <X className="mr-2 h-4 w-4" /> Reject application
                  </Button>
                </div>
              </section>
            )}

            {selectedApplication.status !== 'UNDER_REVIEW' && selectedApplication.reviewer_note && (
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer decision note</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{selectedApplication.reviewer_note}</p>
              </section>
            )}
          </aside>
        ) : (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Select an applicant to inspect their full application.
          </div>
        )}
      </div>
      {documentViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="document-viewer-title">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0"><h2 id="document-viewer-title" className="truncate font-semibold text-foreground">{documentViewer.document.name}</h2><p className="mt-1 text-xs text-muted-foreground">{demoMode ? 'Preview sample · no production file' : 'Authorized private evidence file'}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={documentViewer.url} download={documentViewer.document.name} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary">Download</a>
                <button type="button" onClick={closeDocumentViewer} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close document viewer"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-secondary/30 p-4">
              {String(documentViewer.document.mimeType || '').startsWith('image/') || documentViewer.url.startsWith('data:image') ? (
                <img src={documentViewer.url} alt={documentViewer.document.name} className="mx-auto max-h-[72vh] max-w-full rounded-lg bg-white object-contain shadow-sm" />
              ) : (
                <iframe title={documentViewer.document.name} src={documentViewer.url} sandbox="" referrerPolicy="no-referrer" className="h-[72vh] w-full rounded-lg bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};