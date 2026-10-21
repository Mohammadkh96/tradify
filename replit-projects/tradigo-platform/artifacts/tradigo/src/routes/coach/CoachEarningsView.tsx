import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, BadgeDollarSign, CalendarCheck2, Loader2, WalletCards } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

type CompletedSession = {
  id: string;
  mode: string;
  durationMinutes: number;
  amountCents: number;
  coachNetCents?: number | null;
  completedAt: string | null;
  paymentStatus: string;
  payoutStatus?: string;
  disputeStatus?: string;
  payout?: {
    status: string;
    holdUntil?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    retryable?: boolean;
    reversalReason?: string | null;
    reversedAt?: string | null;
  } | null;
};

type EarningsSummary = {
  completedSessionCount: number;
  lifetimeEarningsCents: number;
  monthEarningsCents: number;
  monthSessionCount: number;
  averageSessionCents: number;
  heldCents: number;
  processingCents: number;
  paidCents: number;
  failedCents: number;
  blockedCents: number;
  nextReleaseAt: string | null;
};

type PayoutAccount = {
  provider: string;
  status: string;
  hasProviderAccount: boolean;
  requiresIndependentVerification?: boolean;
  onboardingUrl?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  verifiedAt?: string | null;
};

const currency = (amountCents: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
}).format(amountCents / 100);

export function CoachEarningsView() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [sessions, setSessions] = useState<CompletedSession[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get('/api/coach/earnings');
      setSummary(data.summary);
      setSessions(data.items ?? []);
      setPayoutAccount(data.payoutAccount ?? null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load earnings right now.');
    }
  }, []);

  const startOnboarding = async () => {
    setOnboardingLoading(true);
    setError(null);
    try {
      const data = await apiClient.post('/api/coach/payout-account/onboarding');
      setPayoutAccount(data.account);
      if (data.onboardingUrl) window.open(data.onboardingUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message || 'PayPal payout onboarding is unavailable right now.');
    } finally {
      setOnboardingLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (!summary && !error) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (session: CompletedSession) => {
    if (session.disputeStatus && session.disputeStatus !== 'NONE') {
      return <span className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">Disputed</span>;
    }
    if (session.payoutStatus === 'PAID') {
      return <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">Paid</span>;
    }
    if (session.payoutStatus === 'VERIFICATION_HOLD') {
      return <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">Verification hold</span>;
    }
    if (session.payout?.status === 'REVERSED' || session.payoutStatus === 'REVERSED') {
      return <span className="rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-700 dark:text-rose-400">Reversed</span>;
    }
    if (session.payout?.status === 'BLOCKED' || session.payoutStatus === 'BLOCKED') {
      return <span className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">Blocked</span>;
    }
    if (session.payout?.status === 'FAILED' || session.payoutStatus === 'FAILED') {
      return <span className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">Needs attention</span>;
    }
    if (session.payout?.status === 'REFUNDED' || session.payoutStatus === 'REFUNDED' || session.paymentStatus === 'REFUNDED') {
      return <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Refunded</span>;
    }
    if (session.payout?.status === 'PROCESSING' || session.payoutStatus === 'PROCESSING') {
      return <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Processing</span>;
    }
    if (session.payoutStatus === 'ELIGIBLE') {
      return <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Eligible</span>;
    }
    if (session.payoutStatus === 'HELD') {
      return <span className="rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">Held</span>;
    }
    return <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Pending</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-primary/5 via-transparent to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <WalletCards className="h-4 w-4" /> Financial Ledger
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Consultation Revenue</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                Gross earnings from completed professional consultations. Payout eligibility occurs after the standard hold period concludes.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-sm min-w-[200px]">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">This Period</p>
              <p className="mt-1 text-3xl font-bold text-foreground tracking-tight">{currency(summary?.monthEarningsCents ?? 0)}</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{summary?.monthSessionCount ?? 0} settled consultation{summary?.monthSessionCount === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm font-medium text-destructive">{error}</div>}

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm" aria-labelledby="payout-setup-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="payout-setup-title" className="font-bold text-base">Payout account</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Tradigo never stores your bank details or identity documents. Connect PayPal in its secure onboarding flow to receive cleared coaching earnings.
            </p>
            {payoutAccount?.requiresIndependentVerification ? (
              <p className="mt-3 max-w-2xl text-sm font-semibold text-amber-700 dark:text-amber-400">
                {payoutAccount.failureMessage || 'PayPal ownership must be independently reverified before payouts can resume. Your unpaid earnings are being held; contact Tradigo support to arrange verification.'}
              </p>
            ) : payoutAccount?.status === 'READY' ? (
              <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">PayPal payout account connected and ready.</p>
            ) : payoutAccount?.failureCode === 'PAYOUT_ACCOUNT_VERIFICATION_UNAVAILABLE' ? (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {payoutAccount.failureMessage || 'Tradigo could not verify the PayPal account server-side. The account remains pending and payouts are blocked.'}
              </p>
            ) : payoutAccount?.status === 'PENDING' ? (
              <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-400">Finish the PayPal onboarding window, then return here. Provider verification may take a few minutes.</p>
            ) : payoutAccount?.failureMessage ? (
              <p className="mt-3 text-sm font-semibold text-destructive">{payoutAccount.failureMessage}</p>
            ) : (
              <p className="mt-3 text-sm font-semibold text-amber-700 dark:text-amber-400">Payout setup is required before a held session can be released.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {payoutAccount?.onboardingUrl && payoutAccount.status === 'PENDING' && !payoutAccount.requiresIndependentVerification && payoutAccount.failureCode !== 'PAYOUT_ACCOUNT_VERIFICATION_UNAVAILABLE' && (
              <a href={payoutAccount.onboardingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
                Continue with PayPal
              </a>
            )}
            {payoutAccount?.status !== 'READY' && !payoutAccount?.requiresIndependentVerification && payoutAccount?.failureCode !== 'PAYOUT_ACCOUNT_VERIFICATION_UNAVAILABLE' && (
              <button type="button" onClick={startOnboarding} disabled={onboardingLoading} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-bold text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                {onboardingLoading ? 'Opening secure setup…' : payoutAccount?.status === 'PENDING' ? 'Start over' : 'Set up payouts'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Revenue', value: currency(summary?.lifetimeEarningsCents ?? 0), icon: BadgeDollarSign },
          { label: 'Engagements', value: String(summary?.completedSessionCount ?? 0), icon: CalendarCheck2 },
          { label: 'Average Value', value: currency(summary?.averageSessionCents ?? 0), icon: ArrowUpRight },
          { label: 'On hold', value: currency(summary?.heldCents ?? 0), icon: WalletCards },
          { label: 'Processing', value: currency(summary?.processingCents ?? 0), icon: Loader2 },
          { label: 'Paid out', value: currency(summary?.paidCents ?? 0), icon: BadgeDollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Icon className="h-5 w-5 text-primary" />
            <p className="mt-5 text-sm font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-6 py-5">
          <div>
            <h2 className="font-bold text-base">Recent Consultations</h2>
            <p className="mt-1 text-xs text-muted-foreground">Each session shows its hold, provider, and settlement state.</p>
          </div>
        </div>
        {sessions.length === 0 ? (
          <div className="p-12 text-center text-sm font-medium text-muted-foreground bg-secondary/10">Your consultation revenue will post here once settled.</div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <article key={session.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between hover:bg-secondary/20 transition-colors">
                <div>
                  <p className="font-semibold text-sm">{session.mode === 'SCHEDULED' ? 'Scheduled Consultation' : 'On-Demand Consultation'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.durationMinutes} min allocation
                    {session.completedAt ? ` · Settled ${new Date(session.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:text-right">
                  {getStatusBadge(session)}
                  <span className="text-base font-bold font-mono tracking-tight">{currency(session.coachNetCents ?? session.amountCents)}</span>
                </div>
                {(session.payout?.failureMessage || session.payout?.reversalReason) && (
                  <p className="text-xs text-destructive sm:max-w-xs sm:text-right">
                    {session.payout.failureMessage || session.payout.reversalReason}
                  </p>
                )}
                {session.payout?.status === 'HELD' && session.payout.holdUntil && (
                  <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">
                    Release review: {new Date(session.payout.holdUntil).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}