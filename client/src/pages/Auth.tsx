import { useState } from "react";
import { useLocation } from "wouter";
import { TrendingUp, Mail, Lock, ArrowRight, ShieldCheck, Zap, BarChart3, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = (e.target as any).elements[0].value;
    localStorage.setItem("user_id", email);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-[#020617] flex overflow-hidden">
      {/* Left Side: Brand & Trust (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-[#0f172a] to-[#020617] relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-2xl shadow-emerald-500/20">
              <TrendingUp size={32} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Tradify</h1>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] mt-1">Institutional Terminal</p>
            </div>
          </div>

          <div className="space-y-10 max-w-md">
            <div>
              <h2 className="text-4xl font-bold text-white mb-4 leading-tight">Professional MT5 analytics and disciplined trading.</h2>
              <p className="text-slate-400 text-lg">No hype. Just deterministic rule-based intelligence for serious traders.</p>
            </div>

            <div className="space-y-6">
              {[
                { icon: <Zap size={20} />, title: "Live MT5 Sync", desc: "Direct integration with your trading terminal." },
                { icon: <BarChart3 size={20} />, title: "Advanced Metrics", desc: "Equity curves, win rates, and drawdown analysis." },
                { icon: <History size={20} />, title: "Rule-Based Journal", desc: "Enforce discipline with custom validation engines." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="mt-1 text-emerald-500">{item.icon}</div>
                  <div>
                    <h4 className="font-bold text-slate-200">{item.title}</h4>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
          <span>© 2026 TRADIFY</span>
          <div className="w-1 h-1 rounded-full bg-slate-800" />
          <span>Precision</span>
          <div className="w-1 h-1 rounded-full bg-slate-800" />
          <span>Discipline</span>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
        
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="text-center lg:text-left">
            <h3 className="text-3xl font-bold text-white">{isLogin ? "Welcome back" : "Create your account"}</h3>
            <p className="text-slate-500 mt-2">
              {isLogin ? "Log in to your trading dashboard." : "Professional MT5 analytics and disciplined trading — no hype."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Terminal</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                  <Input 
                    placeholder="operator@tradify.io" 
                    className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                    type="email"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Key</label>
                  {isLogin && <button type="button" className="text-[10px] font-bold text-emerald-500/70 hover:text-emerald-500 transition-colors uppercase tracking-widest">Forgot?</button>}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                  <Input 
                    placeholder="••••••••" 
                    className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                    type="password"
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm Identity</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                      placeholder="••••••••" 
                      className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                      type="password"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <Button className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-2xl shadow-emerald-500/20">
              {isLogin ? "Initialize Session" : "Create Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="pt-6 border-t border-slate-800/50 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-500 hover:text-emerald-500 text-xs font-bold transition-colors"
            >
              {isLogin ? "Need a terminal? Create account" : "Already registered? Log in"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="flex items-center gap-2 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <ShieldCheck size={16} className="text-emerald-500/50" />
              <span className="text-[9px] text-slate-500 leading-tight">No broker credentials needed</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <ShieldCheck size={16} className="text-emerald-500/50" />
              <span className="text-[9px] text-slate-500 leading-tight">Local MT5 execution</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
