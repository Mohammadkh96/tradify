import { useState, useEffect } from "react";
import { useLocation, Link, Navigate, useSearchParams } from "react-router-dom";
import { TrendingUp, Mail, Lock, ArrowRight, ShieldCheck, Zap, BarChart3, History, Check, X, Globe, User, RefreshCw } from "lucide-react";
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
import { queryClient, getQueryFn } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/PublicNavbar";
import { SEO } from "@/components/SEO";

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
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [country, setCountry] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState<string>("");
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();

  // Check for verified=true or verification_error in URL (after email verification)
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      setRequiresVerification(false);
      setIsLogin(true);
      toast({
        title: "Email Verified",
        description: "Your email has been verified. You can now log in.",
      });
    }
    
    // Handle verification errors
    const verificationError = searchParams.get("verification_error");
    const errorEmail = searchParams.get("email");
    if (verificationError) {
      if (verificationError === "expired") {
        setRequiresVerification(true);
        if (errorEmail) setVerificationEmail(decodeURIComponent(errorEmail));
        toast({
          variant: "destructive",
          title: "Verification Link Expired",
          description: "Your verification link has expired. Please request a new one.",
        });
      } else if (verificationError === "invalid_token") {
        toast({
          variant: "destructive",
          title: "Invalid Verification Link",
          description: "This verification link is invalid or has already been used.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Verification Failed",
          description: "Something went wrong. Please try again.",
        });
      }
    }
    
    // Pre-fill email from early access flow
    const earlyAccessEmail = searchParams.get("email");
    const isFoundingFlow = searchParams.get("founding") === "true";
    if (earlyAccessEmail && !verificationError) {
      setEmail(decodeURIComponent(earlyAccessEmail));
      if (isFoundingFlow) {
        setIsLogin(false); // Switch to signup mode for founding members
      }
    }
  }, [searchParams, toast]);

  const { data: userRole } = useQuery<any>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  useEffect(() => {
    // Auto-detect timezone
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setTimezone(detected);
    } catch (e) {
      console.error("Timezone detection failed", e);
    }
  }, []);

  if (userRole) {
    return <Navigate to="/dashboard" replace />;
  }

  const passwordRules = [
    { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
    { label: "1 uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
    { label: "1 lowercase letter", test: (p: string) => /[a-z]/.test(p) },
    { label: "1 number", test: (p: string) => /[0-9]/.test(p) },
  ];

  const isPasswordValid = passwordRules.every(rule => rule.test(password));
  const isFormValid = isLogin 
    ? (email && password) 
    : (email && fullName && isPasswordValid && password === confirmPassword && !!country && !!timezone && agreedToTerms);

  const handleResendVerification = async () => {
    if (!verificationEmail) return;
    setResendingVerification(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: "Verification Email Sent",
          description: "Please check your inbox for the verification link.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Resend",
          description: data.message || "Could not resend verification email.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to resend verification email.",
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin 
        ? { email, password }
        : { email, password, fullName, country, phoneNumber, timezone };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server error - please try again");
      }

      const data = await response.json();

      // Handle email verification required (for login)
      if (response.status === 403 && data.requiresVerification) {
        setRequiresVerification(true);
        setVerificationEmail(data.email);
        toast({
          variant: "destructive",
          title: "Email Not Verified",
          description: "Please verify your email before logging in.",
        });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      // Handle registration success (requires email verification)
      if (!isLogin && data.requiresVerification) {
        setRequiresVerification(true);
        setVerificationEmail(email);
        toast({
          title: "Account Created",
          description: "Please check your email to verify your account.",
        });
        return;
      }

      // Check if user needs to reset password (admin-created accounts)
      if (data.requiresPasswordReset) {
        setRequiresPasswordReset(true);
        toast({
          title: "Password Reset Required",
          description: "Please set a new password to continue.",
        });
        return;
      }
      
      localStorage.setItem("user_id", data.userId);
      queryClient.setQueryData(["/api/user"], data);
      
      // Store isFirstLogin for tour
      if (data.isFirstLogin) {
        localStorage.setItem("show_tour", "true");
      }
      
      // Redirect based on role
      if (data.role === "OWNER" || data.role === "ADMIN") {
        window.location.replace("/admin/overview");
      } else {
        window.location.replace("/dashboard");
      }
      
      toast({
        title: "Session Initialized",
        description: "Welcome back to TradifyApp.",
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

  // Password Reset Handler for admin-created accounts
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match.",
      });
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword: confirmNewPassword }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      toast({
        title: "Password Updated",
        description: "Your password has been set. Redirecting to dashboard...",
      });

      // Redirect to dashboard after successful password reset
      setTimeout(() => {
        window.location.replace("/dashboard");
      }, 1500);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: err.message || "Failed to update password.",
      });
    }
  };

  // New Password Reset Form for admin-created accounts
  if (requiresPasswordReset) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative pt-20">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl border border-border">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-lg mb-4">
                <Lock size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-bold text-foreground uppercase italic tracking-tighter" data-testid="text-reset-title">Set Your Password</h3>
              <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest font-bold">Create a secure password for your account</p>
            </div>
            <form onSubmit={handlePasswordReset} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="bg-muted border-border text-foreground h-12 pl-10"
                    type="password"
                    required
                    data-testid="input-new-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Confirm Password</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-muted border-border text-foreground h-12 pl-10"
                    type="password"
                    required
                    data-testid="input-confirm-new-password"
                  />
                </div>
              </div>
              <div className="space-y-1 text-xs">
                {passwordRules.map((rule, i) => (
                  <div key={i} className={cn("flex items-center gap-2", rule.test(newPassword) ? "text-emerald-500" : "text-muted-foreground")}>
                    {rule.test(newPassword) ? <Check size={12} /> : <X size={12} />}
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest"
                disabled={!passwordRules.every(rule => rule.test(newPassword)) || newPassword !== confirmNewPassword}
                data-testid="button-set-password"
              >
                Set Password & Continue
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Email verification required screen
  if (requiresVerification) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative pt-20">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl border border-border text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Mail className="text-emerald-500" size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground uppercase italic tracking-tighter">Verify Your Email</h3>
              <p className="text-muted-foreground mt-2 text-sm">
                We've sent a verification link to <span className="text-emerald-500 font-bold">{verificationEmail}</span>
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Please check your inbox and click the verification link to activate your account.
              </p>
              <div className="p-4 bg-muted rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Didn't receive the email?</p>
                <Button
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  variant="outline"
                  className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                  data-testid="button-resend-verification"
                >
                  {resendingVerification ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Verification Email
                    </>
                  )}
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setRequiresVerification(false);
                setIsLogin(true);
              }}
              className="text-muted-foreground text-xs font-bold uppercase tracking-widest"
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative pt-20">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center p-6">
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
                  className="bg-muted border-border text-foreground h-12"
                  type="email"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-emerald-500 text-slate-950 font-black uppercase tracking-widest">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col relative pt-20">
      <SEO 
        title={isLogin ? "Login | Tradify" : "Create Account | Tradify"}
        description={isLogin 
          ? "Sign in to your Tradify trading journal. Access your MT5 sync, analytics, and strategy validation tools."
          : "Create your free Tradify account. Start tracking your trades with MT5 auto-sync and professional analytics."
        }
        canonical={isLogin ? "https://tradifyapp.com/login" : "https://tradifyapp.com/signup"}
      />
      <PublicNavbar />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Brand & Trust (Hidden on Mobile) */}
        <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-muted to-background relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-2xl shadow-emerald-500/20">
                <TrendingUp size={32} strokeWidth={3} />
              </div>
              <div>
                <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic leading-none">TradifyApp</h1>
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
                    <div className="mt-1 text-emerald-500">{item.icon}</div>
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
          <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
          
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
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@tradify.io" 
                      className="pl-10 bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                      type="email"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>
                
                {!isLogin && (
                  <>
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                        <Input 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="John Doe" 
                          className="pl-10 bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                          type="text"
                          required
                          data-testid="input-fullname"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Country</label>
                        <Select value={country} onValueChange={setCountry} required={!isLogin}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50 uppercase text-[10px] tracking-widest">
                            <SelectValue placeholder="SELECT COUNTRY" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-popover-foreground">
                            {countries.map((c) => (
                              <SelectItem key={c} value={c} className="focus:bg-emerald-500 focus:text-slate-950 text-[10px] uppercase tracking-widest">
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Time Zone</label>
                        <Select value={timezone} onValueChange={setTimezone} required={!isLogin}>
                          <SelectTrigger className="bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50 uppercase text-[10px] tracking-widest">
                            <SelectValue placeholder="SELECT ZONE" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-popover-foreground">
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
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Phone (Optional)</label>
                      <Input 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 234 567 890" 
                        className="bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
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
                        className="text-[10px] font-bold text-emerald-500/70 hover:text-emerald-500 transition-colors uppercase tracking-widest"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <Input 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      className="pl-10 bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
                      type="password"
                      required
                    />
                  </div>
                  {!isLogin && password && (
                    <div className="p-3 bg-muted rounded-lg border border-border space-y-1 animate-in fade-in">
                      {passwordRules.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest">
                          {rule.test(password) ? <Check className="text-emerald-500 h-3 w-3" /> : <X className="text-rose-500 h-3 w-3" />}
                          <span className={rule.test(password) ? "text-emerald-500/70" : "text-muted-foreground"}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!isLogin && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Confirm Identity</label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                      <Input 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••" 
                        className="pl-10 bg-muted border-border text-foreground h-12 focus:ring-emerald-500/20 focus:border-emerald-500/50"
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

            <div className="pt-6 border-t border-border text-center">
              <button 
                onClick={() => { setIsLogin(!isLogin); setAgreedToTerms(false); }}
                className="text-muted-foreground hover:text-emerald-500 text-xs font-bold transition-colors"
              >
                {isLogin ? "Need an account? Create one" : "Already registered? Log in"}
              </button>
              {isLogin ? (
                <p className="text-center text-[10px] text-muted-foreground mt-6 leading-relaxed uppercase tracking-widest font-bold">
                  By logging in, you agree to our{" "}
                  <Link to="/terms" className="text-emerald-500 hover:underline">Terms</Link>,{" "}
                  <Link to="/privacy" className="text-emerald-500 hover:underline">Privacy</Link>, and acknowledge the{" "}
                  <Link to="/risk-disclaimer" className="text-emerald-500 hover:underline">Risk Disclaimer</Link>.
                </p>
              ) : (
                <label className="flex items-start gap-3 mt-6 cursor-pointer group" data-testid="checkbox-terms-consent">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-muted text-emerald-500 focus:ring-emerald-500/20 accent-emerald-500 shrink-0"
                    data-testid="input-terms-checkbox"
                  />
                  <span className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-widest font-bold group-hover:text-foreground transition-colors">
                    I agree to the{" "}
                    <Link to="/terms" className="text-emerald-500 hover:underline" onClick={(e) => e.stopPropagation()}>Terms of Service</Link>,{" "}
                    <Link to="/privacy" className="text-emerald-500 hover:underline" onClick={(e) => e.stopPropagation()}>Privacy Policy</Link>, and acknowledge the{" "}
                    <Link to="/risk-disclaimer" className="text-emerald-500 hover:underline" onClick={(e) => e.stopPropagation()}>Risk Disclaimer</Link>.
                  </span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border">
                <ShieldCheck size={16} className="text-emerald-500/50" />
                <span className="text-[9px] text-muted-foreground leading-tight">No broker credentials needed</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl border border-border">
                <ShieldCheck size={16} className="text-emerald-500/50" />
                <span className="text-[9px] text-muted-foreground leading-tight">Local MT5 execution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
