import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { TradigoMark } from '../../components/trading/TradigoLogo';
import {
  isFirebaseConfigured,
  resendVerificationEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../../lib/firebaseAuth';
import { resendLocalVerification, signUpWithLocal } from '../../lib/localAuth';
import { useAuthStore } from '../../stores/authStore';

const inputClassName =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function friendlyAuthError(error: any): string {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'An account already exists for this email. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address to continue.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 8 characters.';
    case 'auth/operation-not-allowed':
      return 'Email sign-up is not enabled for this Tradigo account yet.';
    case 'auth/network-request-failed':
      return 'We could not reach Firebase. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before it finished.';
    default:
      return error?.message || 'We could not create your account. Please try again.';
  }
}

const passwordRules = [
  { label: '8 characters', test: (value: string) => value.length >= 8 },
  { label: 'one uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'one lowercase letter', test: (value: string) => /[a-z]/.test(value) },
  { label: 'one number', test: (value: string) => /\d/.test(value) },
];

export const SignupPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content');
    document.title = 'Create your account | Tradigo';
    description?.setAttribute('content', 'Create your Tradigo account and start learning with live trading education.');
    return () => {
      document.title = previousTitle;
      if (description && previousDescription) description.setAttribute('content', previousDescription);
    };
  }, []);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [verificationSent, setVerificationSent] = useState(true);
  const [verificationAvailable, setVerificationAvailable] = useState(true);

  const passwordsMatch = password === confirmPassword;
  const passwordIsValid = passwordRules.every(rule => rule.test(password));

  const validateForm = () => {
    if (displayName.trim().length < 2) return 'Enter your name so coaches know who they are meeting.';
    if (!email.trim()) return 'Enter your email address to continue.';
    if (!passwordIsValid) return 'Use a password with 8 characters, an uppercase letter, a lowercase letter, and a number.';
    if (!passwordsMatch) return 'Your passwords do not match.';
    if (!termsAccepted) return 'Please agree to Tradigo’s educational terms and privacy practices.';
    return '';
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const session = isFirebaseConfigured
        ? await signUpWithEmail(email, password, displayName)
        : await signUpWithLocal(email, password, displayName);
      if (isFirebaseConfigured && 'firebaseUser' in session) {
        useAuthStore.getState().setFirebaseUser(session.firebaseUser);
      } else {
        useAuthStore.getState().setLocalSessionActive(true);
      }
      await useAuthStore.getState().refreshProfile();
      setCreatedEmail(email.trim());
      const sent = 'verificationSent' in session
        ? session.verificationSent
        : Boolean(session.verification?.sent || session.verification?.queued);
      const localVerificationAvailable = 'verification' in session && Boolean(session.verification?.available);
      setVerificationAvailable(isFirebaseConfigured || localVerificationAvailable);
      setVerificationSent(sent);
      if (!isFirebaseConfigured) {
        setNotice(sent
          ? 'Your account is ready. Check your inbox to verify your email.'
          : 'Your account is ready and verification is pending. Email delivery is not configured yet.');
      } else if (!sent) {
        setNotice('Your account is ready, but we could not send the verification email. You can resend it from this screen.');
      }
    } catch (signupError: any) {
      setError(friendlyAuthError(signupError));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setNotice('');
    if (!termsAccepted) {
      setError('Please agree to Tradigo’s educational terms and privacy practices.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
      localStorage.removeItem('tradigo_dev_token');
      localStorage.removeItem('tradigo_preview_role');
      sessionStorage.removeItem('tradigo_preview_session');
      navigate('/');
    } catch (signupError: any) {
      setError(friendlyAuthError(signupError));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setNotice('');
    try {
      if (isFirebaseConfigured) {
        await resendVerificationEmail();
        setVerificationSent(true);
        setNotice('A new verification email is on its way.');
      } else {
        const result = await resendLocalVerification();
        const accepted = Boolean(result.verification.sent || result.verification.queued);
        setVerificationSent(accepted);
        setNotice(accepted
          ? 'A new verification email is on its way.'
          : 'Verification is pending. Email delivery is not configured yet.');
      }
    } catch (resendError: any) {
      setError(friendlyAuthError(resendError));
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
        <section className="relative hidden overflow-hidden bg-[#0b1729] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-28 top-24 h-80 w-80 rounded-full border border-blue-300/20" />
          <div className="absolute -right-16 top-36 h-56 w-56 rounded-full border border-coral-300/20" />
          <div className="absolute bottom-16 left-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <TradigoMark className="h-5 w-5 text-[#8bbcff]" decorative />
              </div>
              <span className="text-xl font-black tracking-tight">
                tradi<span className="font-serif italic font-normal text-[#ff796d]">go</span>
              </span>
            </div>
            <div className="mt-24 max-w-xl">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.25em] text-[#8bbcff]">Live Point / Human Signal</p>
              <h1 className="max-w-lg text-5xl font-black leading-[1.02] tracking-[-0.04em] xl:text-6xl">
                Start with a clearer learning route.
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-slate-300">
                Build practical trading understanding with live education—not signals, execution, or performance promises.
              </p>
            </div>
          </div>
          <div className="relative grid max-w-xl gap-4 sm:grid-cols-3">
            {[
              ['01', 'Choose your pace', 'Start as a learner and shape your profile over time.'],
              ['02', 'Meet the right coach', 'Find a teaching fit for your process and goals.'],
              ['03', 'Keep your progress', 'Leave each room with notes and a practical next step.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="border-l border-white/20 pl-4">
                <p className="text-xs font-bold text-[#ff9f8e]">{number}</p>
                <p className="mt-2 text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <main className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0b1729]">
                <TradigoMark className="h-5 w-5 text-[#8bbcff]" decorative />
              </div>
              <span className="text-xl font-black tracking-tight">
                tradi<span className="font-serif italic font-normal text-[#f5695d]">go</span>
              </span>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,35,65,0.10)] sm:p-9">
              {createdEmail ? (
                <div className="py-3">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <MailCheck className="h-3.5 w-3.5" />
                    Account created
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">You’re on your way.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                     {verificationAvailable
                       ? verificationSent
                         ? <>Your Tradigo account is ready. We sent a verification link to <strong className="text-slate-700">{createdEmail}</strong>.</>
                         : <>Your Tradigo account is ready. Verification for <strong className="text-slate-700">{createdEmail}</strong> is pending.</>
                        : <>Your Tradigo account is ready. Email verification is currently unavailable.</>}
                  </p>
                  {!verificationSent && (
                    <div role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-800">
                      The verification email has not been delivered yet.
                    </div>
                  )}
                  {notice && (
                    <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-700">
                      {notice}
                    </div>
                  )}
                  <div className="mt-7 space-y-3">
                    <Button type="button" className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20" onClick={() => navigate('/onboarding')}>
                      Continue to setup
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                     <button type="button" onClick={() => navigate('/coach/apply')} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                       Apply to become a coach
                     </button>
                     <p className="text-center text-xs leading-5 text-slate-500">
                       Coaches use the same Tradigo account. Your application is reviewed before your coach profile goes live.
                     </p>
                     {verificationAvailable && (
                       <button type="button" onClick={handleResendVerification} className="w-full py-2 text-sm font-bold text-blue-700 hover:underline">
                         Resend verification email
                       </button>
                     )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                      <LockKeyhole className="h-3.5 w-3.5" />
                      Start your private learning route
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950">Create your account.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">Set up your learner profile and find a teaching fit.</p>
                  </div>

                  {error && (
                    <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700">
                      {error}
                    </div>
                  )}
                  {notice && (
                    <div role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-700">
                      {notice}
                    </div>
                  )}

                  <form onSubmit={handleSignup} className="space-y-5">
                    <div>
                      <label htmlFor="signup-name" className="mb-2 block text-sm font-bold text-slate-700">Your name</label>
                      <input id="signup-name" type="text" value={displayName} onChange={event => setDisplayName(event.target.value)} className={inputClassName} placeholder="How coaches should address you" autoComplete="name" required />
                    </div>
                    <div>
                      <label htmlFor="signup-email" className="mb-2 block text-sm font-bold text-slate-700">Email address</label>
                      <input id="signup-email" type="email" value={email} onChange={event => setEmail(event.target.value)} className={inputClassName} placeholder="you@example.com" autoComplete="email" required />
                    </div>
                    <div>
                      <label htmlFor="signup-password" className="mb-2 block text-sm font-bold text-slate-700">Password</label>
                      <div className="relative">
                        <input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} className={`${inputClassName} pr-12`} placeholder="Create a strong password" autoComplete="new-password" aria-describedby="password-help" required />
                        <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p id="password-help" className="mt-2 text-xs leading-5 text-slate-500">
                        {passwordRules.map(rule => (
                          <span key={rule.label} className={`mr-2 inline-flex items-center gap-1 ${rule.test(password) ? 'text-emerald-600' : 'text-slate-400'}`}>
                            <Check className="h-3 w-3" />
                            {rule.label}
                          </span>
                        ))}
                      </p>
                    </div>
                    <div>
                      <label htmlFor="signup-confirm-password" className="mb-2 block text-sm font-bold text-slate-700">Confirm password</label>
                      <div className="relative">
                        <input id="signup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={`${inputClassName} pr-12`} placeholder="Repeat your password" autoComplete="new-password" required />
                        <button type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 text-xs leading-5 text-slate-500">
                      <Checkbox checked={termsAccepted} onCheckedChange={value => setTermsAccepted(value === true)} aria-label="Agree to Tradigo terms and privacy practices" className="mt-0.5" />
                      <span>
                        I agree to use Tradigo for education only and accept its terms and privacy practices. Tradigo never provides signals, execution, guarantees, or performance promises.
                      </span>
                    </label>

                    <Button type="submit" className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20" disabled={loading}>
                      {loading ? 'Creating account…' : 'Create account'}
                      {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </form>

                  {isFirebaseConfigured && (
                    <>
                      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span>or continue with</span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <button type="button" onClick={handleGoogleSignup} disabled={loading} className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50">
                        <span className="text-base font-black text-blue-600">G</span>
                        Google
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="mt-5 flex items-start gap-3 px-2 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p>Your account protects your learning history, session records, and private journey passport.</p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 text-center">
              <button type="button" onClick={() => navigate('/login')} className="text-sm font-bold text-blue-700 hover:underline">
                Already have an account? Sign in
              </button>
              <button type="button" onClick={() => navigate('/preview')} className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline">
                Explore the marketplace demo
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};