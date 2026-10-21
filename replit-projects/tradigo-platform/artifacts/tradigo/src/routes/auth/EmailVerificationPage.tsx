import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Clock3, MailCheck, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TradigoMark } from '../../components/trading/TradigoLogo';
import {
  completeLocalVerification,
  resendLocalVerification,
  type LocalAuthError,
} from '../../lib/localAuth';

type VerificationState = 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'EXPIRED' | 'INVALID';

export function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [state, setState] = useState<VerificationState>(token ? 'VERIFYING' : 'PENDING');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    completeLocalVerification(token)
      .then(() => {
        if (active) setState('VERIFIED');
      })
      .catch((error: LocalAuthError) => {
        if (!active) return;
        setMessage(error.message);
        setState(error.status === 410 ? 'EXPIRED' : 'INVALID');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const resend = async () => {
    setResending(true);
    setMessage('');
    try {
      const result = await resendLocalVerification();
      if (result.verification.status === 'VERIFIED') {
        setState('VERIFIED');
      } else {
        setState('PENDING');
        setMessage(result.verification.sent || result.verification.queued
          ? 'A new verification email is on its way.'
          : 'Your email is still pending verification. Email delivery is not configured yet.');
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setResending(false);
    }
  };

  const content = {
    VERIFYING: {
      icon: <Clock3 className="h-8 w-8 text-blue-600" />,
      title: 'Checking your link…',
      copy: 'We’re confirming this email verification request.',
    },
    VERIFIED: {
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-600" />,
      title: 'Email verified.',
      copy: 'Your Tradigo account now has a verified email address.',
    },
    EXPIRED: {
      icon: <Clock3 className="h-8 w-8 text-amber-600" />,
      title: 'This link has expired.',
      copy: 'Verification links last 24 hours. Request a fresh link to continue.',
    },
    INVALID: {
      icon: <XCircle className="h-8 w-8 text-red-600" />,
      title: 'This link is not valid.',
      copy: 'It may have already been replaced. Request a fresh verification link.',
    },
    PENDING: {
      icon: <MailCheck className="h-8 w-8 text-blue-600" />,
      title: 'Verification pending.',
      copy: 'Open the verification link in your email, or request a new one below.',
    },
  }[state];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,35,65,0.10)]">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0b1729]">
          <TradigoMark className="h-6 w-6 text-[#8bbcff]" decorative />
        </div>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
          {content.icon}
        </div>
        <h1 className="text-3xl font-black tracking-tight">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{content.copy}</p>
        {message && (
          <p role="status" className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-700">
            {message}
          </p>
        )}
        <div className="mt-7 space-y-3">
          {state === 'VERIFIED' ? (
            <Button className="h-12 w-full rounded-xl font-bold" onClick={() => navigate('/')}>
              Continue to Tradigo
            </Button>
          ) : state !== 'VERIFYING' ? (
            <Button className="h-12 w-full rounded-xl font-bold" onClick={resend} disabled={resending}>
              {resending ? 'Requesting…' : 'Send a new verification email'}
            </Button>
          ) : null}
          <button type="button" onClick={() => navigate('/login')} className="w-full py-2 text-sm font-bold text-blue-700 hover:underline">
            Back to sign in
          </button>
        </div>
      </section>
    </main>
  );
}