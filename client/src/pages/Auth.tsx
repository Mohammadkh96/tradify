import { useState } from "react";
import { useLocation } from "wouter";
import { TrendingUp, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo login
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6">
      <div className="mb-10 flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/20">
          <TrendingUp size={40} />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Tradify</h1>
          <p className="text-slate-500 text-sm mt-1">Rule-Based Trading Intelligence</p>
        </div>
      </div>

      <Card className="w-full max-w-md bg-slate-900/50 border-slate-800 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold text-white">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <p className="text-slate-500 text-xs mt-2">
            {isLogin ? "Enter your credentials to access your terminal" : "Sign up to start journaling with discipline"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Email Address" 
                  className="pl-10 bg-slate-950 border-slate-800 text-white h-11 focus:ring-emerald-500/20"
                  type="email"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input 
                  placeholder="Password" 
                  className="pl-10 bg-slate-950 border-slate-800 text-white h-11 focus:ring-emerald-500/20"
                  type="password"
                  required
                />
              </div>
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Confirm Password" 
                    className="pl-10 bg-slate-950 border-slate-800 text-white h-11 focus:ring-emerald-500/20"
                    type="password"
                    required
                  />
                </div>
              </div>
            )}
            
            <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-xs transition-all mt-4">
              {isLogin ? "Login to Terminal" : "Initialize Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-500 hover:text-emerald-500 text-xs font-bold transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 flex gap-8 text-[10px] font-bold text-slate-700 uppercase tracking-[0.2em]">
        <span>Precision</span>
        <div className="w-1 h-1 rounded-full bg-slate-800 mt-1.5" />
        <span>Discipline</span>
        <div className="w-1 h-1 rounded-full bg-slate-800 mt-1.5" />
        <span>Profitability</span>
      </div>
    </div>
  );
}
