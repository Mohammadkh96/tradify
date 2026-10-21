import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { isFirebaseConfigured, signInWithGoogle } from '../../lib/firebaseAuth';
import { signInWithLocal } from '../../lib/localAuth';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { TradigoMark } from '../../components/trading/TradigoLogo';

export const LoginPage = () => {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const friendlyAuthError = (err: any) => {
    switch (err?.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That email and password combination could not be verified.';
      case 'auth/invalid-email':
        return 'Enter a valid email address to continue.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/popup-closed-by-user':
        return 'The Google sign-in window was closed before it finished.';
      default:
        return err?.message || 'We could not sign you in. Please try again.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (isFirebaseConfigured) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithLocal(email, password);
        useAuthStore.getState().setLocalSessionActive(true);
        await useAuthStore.getState().refreshProfile();
      }
      localStorage.removeItem('tradigo_dev_token');
      localStorage.removeItem('tradigo_preview_role');
      sessionStorage.removeItem('tradigo_preview_session');
      navigate('/');
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await signInWithGoogle();
      localStorage.removeItem('tradigo_dev_token');
      localStorage.removeItem('tradigo_preview_role');
      sessionStorage.removeItem('tradigo_preview_session');
      navigate('/');
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('Enter your email address first and we’ll send a reset link.');
      return;
    }
    if (!isFirebaseConfigured) {
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('If an account exists for that email, a reset link is on its way.');
    } catch (err: any) {
      setError(friendlyAuthError(err));
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
                Make the next decision with a real coach.
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-slate-300">
                Private, live trading education built around your process—not promises, signals, or performance claims.
              </p>
            </div>
          </div>
          <div className="relative grid max-w-xl gap-4 sm:grid-cols-3">
            {[
              ['01', 'Human context', 'Talk through the decision in front of you.'],
              ['02', 'Verified rooms', 'Enter with a clear, protected session record.'],
              ['03', 'Keep learning', 'Leave with notes and a practical next step.'],
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
              <div className="mb-8">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Secure member access
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950">Welcome back.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to continue your learning route.</p>
              </div>

              {error && (
                <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700">
                  {error}
                </div>
              )}
              {notice && (
                <div role="status" className="mb-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="signin-email" className="mb-2 block text-sm font-bold text-slate-700">Email address</label>
                  <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="signin-password" className="block text-sm font-bold text-slate-700">Password</label>
                    <button type="button" onClick={handlePasswordReset} className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
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
                  <button type="button" onClick={handleGoogleLogin} disabled={loading} className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    <span className="text-base font-black text-blue-600">G</span>
                    Google
                  </button>
                </>
              )}

              <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  New to Tradigo?{' '}
                  <button type="button" onClick={() => navigate('/signup')} className="font-bold text-blue-700 hover:underline">
                    Create an account
                  </button>
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-3 px-2 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p>Tradigo is educational only. We never provide signals, execution, guarantees, or performance promises.</p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 text-center">
              <button type="button" onClick={() => navigate('/preview')} className="text-sm font-bold text-blue-700 hover:underline">
                Explore the marketplace demo
              </button>
              <button type="button" onClick={() => navigate('/preview/admin')} className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline">
                Preview the admin control plane
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
