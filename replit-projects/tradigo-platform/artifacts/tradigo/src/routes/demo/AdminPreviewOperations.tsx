import React from 'react';
import { Activity, Calendar, Database, DollarSign, FlaskConical, Settings, ShieldCheck } from 'lucide-react';

type PreviewSection = 'demo-lab' | 'sessions' | 'payments' | 'settings';

const sectionCopy: Record<PreviewSection, { title: string; description: string; icon: typeof Activity }> = {
  'demo-lab': {
    title: 'Demo Lab',
    description: 'A safe walkthrough of Tradigo’s operational test environment.',
    icon: FlaskConical,
  },
  sessions: {
    title: 'Session Operations',
    description: 'Monitor protected coaching rooms, attendance, and settlement readiness.',
    icon: Calendar,
  },
  payments: {
    title: 'Payment Operations',
    description: 'Review authorization, settlement, payout holds, and reconciliation states.',
    icon: DollarSign,
  },
  settings: {
    title: 'Admin Settings',
    description: 'Preview platform governance and administrator configuration areas.',
    icon: Settings,
  },
};

const sessionRows = [
  ['TRD-2048', 'Maya Chen · Omar Haddad', 'LIVE', 'Attendance verified'],
  ['TRD-2047', 'Lucas Meyer · Sofia Rahman', 'COMPLETED', 'Settlement queued'],
  ['TRD-2045', 'Nadia Rahman · Elias Morgan', 'NO_SHOW_REVIEW', 'Moderator review'],
];

const paymentRows = [
  ['PAY-3108', 'Maya Chen', 'PAYOUT_HOLD', '$84.00', 'Identity review'],
  ['PAY-3107', 'Omar Haddad', 'SETTLED', '$56.00', 'Completed'],
  ['PAY-3105', 'Sofia Rahman', 'REFUND_READY', '$42.00', 'Cancellation policy'],
];

export function AdminPreviewOperations({ section }: { section: PreviewSection }) {
  const copy = sectionCopy[section];
  const Icon = copy.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Icon className="h-7 w-7 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{copy.title}</h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">{copy.description}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
          <ShieldCheck className="h-3.5 w-3.5" />
          Preview data
        </span>
      </div>

      {section === 'sessions' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Recent coaching sessions</h2>
            <p className="mt-1 text-xs text-gray-500">No production rooms or participant records are changed from this preview.</p>
          </div>
          <div className="divide-y divide-gray-200">
            {sessionRows.map(([id, participants, state, detail]) => (
              <div key={id} className="grid grid-cols-1 gap-2 px-6 py-4 sm:grid-cols-[1fr_2fr_1fr_1.5fr] sm:items-center">
                <span className="font-mono text-xs text-gray-500">{id}</span>
                <span className="text-sm font-medium text-gray-900">{participants}</span>
                <span className="text-xs font-semibold text-indigo-700">{state}</span>
                <span className="text-xs text-gray-500">{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'payments' && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Settlement and payout queue</h2>
            <p className="mt-1 text-xs text-gray-500">Financial settlement remains independent of subjective review outcomes.</p>
          </div>
          <div className="divide-y divide-gray-200">
            {paymentRows.map(([id, coach, state, amount, detail]) => (
              <div key={id} className="grid grid-cols-1 gap-2 px-6 py-4 sm:grid-cols-[1fr_1.5fr_1.5fr_1fr_1.5fr] sm:items-center">
                <span className="font-mono text-xs text-gray-500">{id}</span>
                <span className="text-sm font-medium text-gray-900">{coach}</span>
                <span className="text-xs font-semibold text-indigo-700">{state}</span>
                <span className="text-sm font-semibold text-gray-900">{amount}</span>
                <span className="text-xs text-gray-500">{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'demo-lab' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ['Environment', 'STAGING PREVIEW', Database],
            ['Actor safety', 'ISOLATED', ShieldCheck],
            ['Live activity', 'READ-ONLY', Activity],
          ].map(([label, value, CardIcon]) => (
            <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <CardIcon className="h-5 w-5 text-indigo-600" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gray-500">{label as string}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{value as string}</p>
            </div>
          ))}
        </div>
      )}

      {section === 'settings' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Governance configuration</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['Require verified attendance before settlement', 'Keep review moderation separate from payouts', 'Record administrator actions in the audit trail', 'Protect participant learning history by default'].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}