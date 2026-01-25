import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { TrendingUp, Mail, Lock, ArrowRight, ShieldCheck, Zap, BarChart3, History, Check, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam",
  "Yemen",
  "Zambia", "Zimbabwe"
];

const timezones = Intl.supportedValuesOf('timeZone');

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState<string>("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Auto-detect timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    } catch (e) {
      console.error("Timezone detection failed", e);
    }
  }, []);

  const passwordRules = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "1 uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "1 lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "1 number", test: (p: string) => /[0-9]/.test(p) },
  ];

  const isPasswordValid = passwordRules.every(rule => rule.test(password));
  const isFormValid = isLogin 
    ? email && password 
    : email && isPasswordValid && password === confirmPassword && country && timezone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    try {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const payload = isLogin 
        ? { email, password }
        : { email, password, country, phoneNumber, timezone };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }
      
      localStorage.setItem("user_id", data.userId);
      queryClient.setQueryData(["/api/user"], data);
      
      // Redirect based on role
      if (data.role === "OWNER" || data.role === "ADMIN") {
        window.location.replace("/admin/overview");
      } else {
        window.location.replace("/dashboard");
      }
      
      toast({
        title: isLogin ? "Session Initialized" : "Account Created",
        description: isLogin ? "Welcome back to the terminal." : "Precision trading starts now.",
      });
    } catch (err: any) {
      console.error("Auth error:", err);
      toast({
        variant: "destructive",
        title: isLogin ? "Login Failed" : "Registration Failed",
        description: err.message || "An error occurred.",
      });
    }
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
        
        <div className="w-full max-w-md space-y-8 relative z-10 py-12">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@tradify.io" 
                    className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                    type="email"
                    required
                  />
                </div>
              </div>
              
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Country</label>
                      <Select value={country} onValueChange={setCountry} required={!isLogin}>
                        <SelectTrigger className="bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50 uppercase text-[10px] tracking-widest">
                          <SelectValue placeholder="SELECT COUNTRY" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          {countries.map((c) => (
                            <SelectItem key={c} value={c} className="focus:bg-emerald-500 focus:text-slate-950 text-[10px] uppercase tracking-widest">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Time Zone</label>
                      <Select value={timezone} onValueChange={setTimezone} required={!isLogin}>
                        <SelectTrigger className="bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50 uppercase text-[10px] tracking-widest">
                          <SelectValue placeholder="SELECT ZONE" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          {timezones.map((tz) => (
                            <SelectItem key={tz} value={tz} className="focus:bg-emerald-500 focus:text-slate-950 text-[10px] uppercase tracking-widest">
                              {tz.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone (Optional)</label>
                    <Input 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 890" 
                      className="bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                  {isLogin && <button type="button" className="text-[10px] font-bold text-emerald-500/70 hover:text-emerald-500 transition-colors uppercase tracking-widest">Forgot?</button>}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                  <Input 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                    type="password"
                    required
                  />
                </div>
                {!isLogin && password && (
                  <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-1 animate-in fade-in">
                    {passwordRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
                        {rule.test(password) ? <Check className="text-emerald-500 h-3 w-3" /> : <X className="text-rose-500 h-3 w-3" />}
                        <span className={rule.test(password) ? "text-emerald-500/70" : "text-slate-500"}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm Identity</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="pl-10 bg-[#0f172a] border-slate-800 text-white h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                      type="password"
                      required
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>

            <Button 
              type="submit"
              disabled={!isFormValid}
              className="w-full h-14 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-black uppercase tracking-[0.15em] text-xs transition-all shadow-2xl shadow-emerald-500/20 disabled:opacity-50 disabled:grayscale"
            >
              {isLogin ? "Initialize Session" : "Establish Account"}
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
