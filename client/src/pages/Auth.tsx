import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
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
import { queryClient } from "@/lib/queryClient";

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
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
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
    ? (email && password) 
    : (email && isPasswordValid && password === confirmPassword && !!country && !!timezone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin 
        ? { email, password }
        : { email, password, country, phoneNumber: phoneNumber || null, timezone };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Response not OK:", data);
        throw new Error(data.error?.message || data.message || "Authentication failed");
      }
      
      localStorage.setItem("user_id", data.user.id);
      localStorage.setItem("accessToken", data.accessToken);
      
      // Update query client before redirecting
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Redirect based on role
      if (data.user.role === "admin") {
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

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/user/reset-password-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json();
      toast({
        title: "Reset Link Sent",
        description: data.message,
      });
      setShowForgot(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process reset request.",
      });
    }
  };

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl border border-border">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-foreground uppercase italic tracking-tighter">Reset Password</h3>
            <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest font-bold">Enter your email to receive a recovery link</p>
          </div>
          <form onSubmit={handleResetRequest} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
              <Input 
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="operator@tradify.io"
                className="bg-background border-border text-foreground h-12"
                type="email"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground font-black uppercase tracking-widest">
              Send Recovery Link
            </Button>
            <button 
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-widest"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {/* Left Side: Brand & Trust (Hidden on Mobile) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-card to-background relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/20">
              <TrendingUp size={32} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic leading-none">Tradify</h1>
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mt-1">Institutional Terminal</p>
            </div>
          </div>

          <div className="space-y-10 max-w-md">
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-4 leading-tight">Professional MT5 analytics and disciplined trading.</h2>
              <p className="text-muted-foreground text-lg">No hype. Just deterministic rule-based intelligence for serious traders.</p>
            </div>

            <div className="space-y-6">
              {[
                { icon: <Zap size={20} />, title: "Live MT5 Sync", desc: "Direct integration with your trading terminal." },
                { icon: <BarChart3 size={20} />, title: "Advanced Metrics", desc: "Equity curves, win rates, and drawdown analysis." },
                { icon: <History size={20} />, title: "Rule-Based Journal", desc: "Enforce discipline with custom validation engines." }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="mt-1 text-primary">{item.icon}</div>
                  <div>
                    <h4 className="font-bold text-foreground">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          <span>© 2026 TRADIFY</span>
          <div className="w-1 h-1 rounded-full bg-border" />
          <span>Precision</span>
          <div className="w-1 h-1 rounded-full bg-border" />
          <span>Discipline</span>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
        
        <div className="w-full max-w-md space-y-8 relative z-10 py-12">
          <div className="text-center lg:text-left">
            <h3 className="text-3xl font-bold text-foreground">{isLogin ? "Welcome back" : "Create your account"}</h3>
            <p className="text-muted-foreground mt-2">
              {isLogin ? "Log in to your trading dashboard." : "Professional MT5 analytics and disciplined trading — no hype."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Terminal</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@tradify.io" 
                    className="pl-10 bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50"
                    type="email"
                    required
                  />
                </div>
              </div>
              
              {!isLogin && (
                <>
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Country</label>
                      <Select value={country} onValueChange={setCountry} required={!isLogin}>
                        <SelectTrigger className="bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50 uppercase text-[10px] tracking-widest">
                          <SelectValue placeholder="SELECT COUNTRY" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {countries.map((c) => (
                            <SelectItem key={c} value={c} className="focus:bg-primary focus:text-primary-foreground text-[10px] uppercase tracking-widest">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Time Zone</label>
                      <Select value={timezone} onValueChange={setTimezone} required={!isLogin}>
                        <SelectTrigger className="bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50 uppercase text-[10px] tracking-widest">
                          <SelectValue placeholder="SELECT ZONE" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {timezones.map((tz) => (
                            <SelectItem key={tz} value={tz} className="focus:bg-primary focus:text-primary-foreground text-[10px] uppercase tracking-widest">
                              {tz.replace(/_/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Phone (Optional)</label>
                    <Input 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 890" 
                      className="bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Password</label>
                  {isLogin && (
                    <button 
                      type="button" 
                      onClick={() => setShowForgot(true)}
                      className="text-[10px] font-bold text-primary/70 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="pl-10 bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50"
                    type="password"
                    required
                  />
                </div>
                {!isLogin && password && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-1 animate-in fade-in">
                    {passwordRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
                        {rule.test(password) ? <Check className="text-primary h-3 w-3" /> : <X className="text-destructive h-3 w-3" />}
                        <span className={rule.test(password) ? "text-primary/70" : "text-muted-foreground"}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Confirm Identity</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="pl-10 bg-background border-border text-foreground h-12 focus:ring-primary/20 focus:border-primary/50"
                      type="password"
                      required
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-[9px] font-bold text-destructive uppercase tracking-widest ml-1">Passwords do not match</p>
                  )}
                </div>
              )}
            </div>

            <Button 
              type="submit"
              disabled={!isFormValid}
              className="w-full h-14 bg-gradient-to-r from-primary/80 to-primary hover:from-primary hover:to-primary/90 text-primary-foreground font-black uppercase tracking-[0.15em] text-xs transition-all shadow-2xl shadow-primary/20 disabled:opacity-50 disabled:grayscale"
            >
              {isLogin ? "Initialize Session" : "Establish Account"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="pt-6 border-t border-border/50 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-primary text-xs font-bold transition-colors"
            >
              {isLogin ? "Need a terminal? Create account" : "Already registered? Log in"}
            </button>
            <p className="text-center text-[10px] text-muted-foreground mt-6 leading-relaxed uppercase tracking-widest font-bold">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms</Link>,{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy</Link>, and acknowledge the{" "}
              <Link href="/risk" className="text-primary hover:underline">Risk Disclaimer</Link>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
              <ShieldCheck size={16} className="text-primary/50" />
              <span className="text-[9px] text-muted-foreground leading-tight">No broker credentials needed</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
              <ShieldCheck size={16} className="text-primary/50" />
              <span className="text-[9px] text-muted-foreground leading-tight">Local MT5 execution</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
