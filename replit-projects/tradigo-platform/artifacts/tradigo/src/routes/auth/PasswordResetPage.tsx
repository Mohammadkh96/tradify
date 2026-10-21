import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TradigoMark } from '../../components/trading/TradigoLogo';
import {
  completeLocalPasswordReset,
  requestLocalPasswordReset,
  type LocalAuthError,
} from '../../lib/localAuth';

const inputClassName =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

export function PasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<'READY' | 'SENDING' | 'SENT' | 'RESETTING' | 'COMPLETED' | 'EXPIRED'>('READY');
  const [error, setError] = useState('');

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setState('SENDING');
    try {
      await requestLocalPasswordReset(email);
      setState('SENT');
    } catch (requestError) {
      setError((requestError as Error).message);
      setState('READY');
    }
  };

  const completeReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Your passwords do not match.');
      return;
    }
    setState('RESETTING');
    try {
      await completeLocalPasswordReset(token, password);
      setState('COMPLETED');
    } catch (resetError) {
      const authError = resetError as LocalAuthError;
      setError(authError.message);
      setState(authError.status === 410 ? 'EXPIRED' : 'READY');
    }
  };

  const completed = state === 'COMPLETED';
  const expired = state === 'EXPIRED';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,35,65,0.10)]">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b1729]">
            <TradigoMark className="h-5 w-5 text-[#8bbcff]" decorative />
          </div>
          <span className="text-xl font-black tracking-tight">tradi<span className="font-serif italic font-normal text-[#f5695d]">go</span></span>
        </div>

        {completed ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">Password updated.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Your reset link is now complete and cannot be used again. Sign in with your new password.</p>
            <Button className="mt-7 h-12 w-full rounded-xl font-bold" onClick={() => navigate('/login')}>Return to sign in</Button>
          </div>
        ) : expired ? (
          <div className="text-center">
            <KeyRound className="mx-auto h-12 w-12 text-amber-600" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">Reset link expired.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">Password reset links last one hour and can only be used once.</p>
            {error && <p role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p>}
            <Button className="mt-7 h-12 w-full rounded-xl font-bold" onClick={() => navigate('/reset-password')}>Request a new link</Button>
          </div>
        ) : token ? (
          <>
            <KeyRound className="h-9 w-9 text-blue-600" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">Choose a new password.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use at least 8 characters with uppercase, lowercase, and a number.</p>
            {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <form onSubmit={completeReset} className="mt-7 space-y-5">
              <div>
                <label htmlFor="reset-password" className="mb-2 block text-sm font-bold text-slate-700">New password</label>
                <div className="relative">
                  <input id="reset-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className={`${inputClassName} pr-12`} autoComplete="new-password" required />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="reset-confirm-password" className="mb-2 block text-sm font-bold text-slate-700">Confirm new password</label>
                <input id="reset-confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={inputClassName} autoComplete="new-password" required />
              </div>
              <Button type="submit" className="h-12 w-full rounded-xl font-bold" disabled={state === 'RESETTING'}>
                {state === 'RESETTING' ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          </>
        ) : state === 'SENT' ? (
          <div className="text-center">
            <Mail className="mx-auto h-12 w-12 text-blue-600" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">Check your email.</h1>
            <p role="status" className="mt-3 text-sm leading-6 text-slate-500">If an account exists for that email, a password reset link is on its way.</p>
            <button type="button" onClick={() => setState('READY')} className="mt-7 text-sm font-bold text-blue-700 hover:underline">Try another email</button>
          </div>
        ) : (
          <>
            <Mail className="h-9 w-9 text-blue-600" />
            <h1 className="mt-5 text-3xl font-black tracking-tight">Reset your password.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Enter your email. We’ll send the same response whether or not an account exists.</p>
            {error && <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
            <form onSubmit={requestReset} className="mt-7 space-y-5">
              <div>
                <label htmlFor="reset-email" className="mb-2 block text-sm font-bold text-slate-700">Email address</label>
                <input id="reset-email" type="email" value={email} onChange={event => setEmail(event.target.value)} className={inputClassName} autoComplete="email" required />
              </div>
              <Button type="submit" className="h-12 w-full rounded-xl font-bold" disabled={state === 'SENDING'}>
                {state === 'SENDING' ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </>
        )}

        {!completed && (
          <button type="button" onClick={() => navigate('/login')} className="mt-7 w-full py-2 text-center text-sm font-bold text-blue-700 hover:underline">
            Back to sign in
          </button>
        )}
      </section>
    </main>
  );
}