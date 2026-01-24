import { useQuery } from "@tanstack/react-query";
import { User, Shield, Key, Zap, Save, ChevronRight, CheckCircle2, Mail, BadgeCheck, Clock, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Profile() {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const { data: userRole, isLoading } = useQuery<any>({
    queryKey: ["/api/user/role", localStorage.getItem("user_id")],
    queryFn: async () => {
      const userId = localStorage.getItem("user_id");
      const res = await fetch(`/api/user/role${userId ? `?userId=${userId}` : ""}`);
      return res.json();
    }
  });

  const { data: mt5Status } = useQuery<any>({
    queryKey: [`/api/mt5/status/${localStorage.getItem("user_id")}`],
    enabled: !!localStorage.getItem("user_id")
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 md:col-span-2 bg-slate-800" />
          <Skeleton className="h-64 bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#020617] min-h-screen text-slate-50">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/50 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <h1 className="text-5xl font-black uppercase tracking-tighter italic text-white leading-none">
                Operator <span className="text-emerald-500">Profile</span>
              </h1>
              {userRole?.subscriptionTier === "PRO" && (
                <Badge className="bg-emerald-500 text-slate-950 border-none px-3 py-1 text-[10px] font-black tracking-widest uppercase rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  PRO
                </Badge>
              )}
            </div>
            <p className="text-slate-500 text-[10px] uppercase tracking-[0.4em] font-black opacity-70">Terminal Identity & System Configuration</p>
          </div>
          
          <div className="flex items-center gap-4 bg-[#0b1120] p-4 px-6 rounded-2xl border border-slate-800 shadow-2xl">
            <div className="text-right">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">System Status</div>
              <div className="text-xs font-black text-emerald-500 flex items-center gap-2 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                Operational
              </div>
            </div>
            <div className="w-px h-10 bg-slate-800 mx-2" />
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
              <Shield size={24} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Sections */}
          <div className="lg:col-span-8 space-y-8">
            {/* Account Identity */}
            <Card className="bg-[#0b1120] border-slate-800 shadow-2xl overflow-hidden rounded-3xl">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50" />
              <CardHeader className="p-8 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20 shadow-lg">
                    <User size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">Terminal Identity</CardTitle>
                    <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-60">Manage your operator credentials</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                      <Mail size={12} className="text-emerald-500" /> Operator Email
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800/50 rounded-2xl px-5 h-14 flex items-center text-sm font-mono text-slate-400 shadow-inner">
                      {userRole?.userId}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                      <BadgeCheck size={12} className="text-emerald-500" /> Terminal Access
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800/50 rounded-2xl px-5 h-14 flex items-center text-sm font-black text-emerald-500 uppercase tracking-widest shadow-inner">
                      {userRole?.role}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Operator Alias</label>
                    <Input 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ENTER ALIAS"
                      className="bg-slate-950 border-slate-800/50 h-14 text-sm font-bold uppercase tracking-wider focus:border-emerald-500/50 focus:ring-emerald-500/10 transition-all rounded-2xl px-5 shadow-inner"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">System Timezone</label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="bg-slate-950 border-slate-800/50 h-14 text-sm font-bold uppercase tracking-wider rounded-2xl px-5 shadow-inner">
                        <SelectValue placeholder="SELECT TIMEZONE" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-xl overflow-hidden border-none shadow-2xl">
                        <SelectItem value="UTC" className="focus:bg-emerald-500/20 focus:text-emerald-500 uppercase text-[10px] font-black tracking-widest">UTC (Universal)</SelectItem>
                        <SelectItem value="EST" className="focus:bg-emerald-500/20 focus:text-emerald-500 uppercase text-[10px] font-black tracking-widest">EST (New York)</SelectItem>
                        <SelectItem value="GST" className="focus:bg-emerald-500/20 focus:text-emerald-500 uppercase text-[10px] font-black tracking-widest">GST (Dubai)</SelectItem>
                        <SelectItem value="SGT" className="focus:bg-emerald-500/20 focus:text-emerald-500 uppercase text-[10px] font-black tracking-widest">SGT (Singapore)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] h-14 px-12 gap-3 shadow-[0_10px_30px_rgba(16,185,129,0.2)] rounded-2xl transition-all active:scale-95 group">
                    <Save size={16} className="group-hover:rotate-12 transition-transform" /> Commit Changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Security Console */}
            <Card className="bg-[#0b1120] border-slate-800 shadow-2xl overflow-hidden rounded-3xl">
              <CardHeader className="p-8 pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20 shadow-lg">
                    <Key size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white">Security Keys</CardTitle>
                    <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 opacity-60">Update system access credentials</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Current Master Key</label>
                  <Input type="password" placeholder="••••••••••••••••" className="bg-slate-950 border-slate-800/50 h-14 rounded-2xl px-5 shadow-inner" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">New Terminal Key</label>
                    <Input type="password" placeholder="••••••••••••••••" className="bg-slate-950 border-slate-800/50 h-14 rounded-2xl px-5 shadow-inner" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Confirm Identity</label>
                    <Input type="password" placeholder="••••••••••••••••" className="bg-slate-950 border-slate-800/50 h-14 rounded-2xl px-5 shadow-inner" />
                  </div>
                </div>
                <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] h-14 px-10 rounded-2xl transition-all hover:text-white">
                  Rotate Security Keys
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Dynamic Status & Plan */}
          <div className="lg:col-span-4 space-y-8 sticky top-8">
            {/* Plan Card */}
            <Card className="bg-gradient-to-b from-[#111827] to-[#0b1120] border-slate-800 overflow-hidden relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-3xl group">
              <div className="absolute top-0 right-0 p-6">
                <Badge className={cn(
                  "font-black text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-2xl border-none",
                  userRole?.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                )}>
                  {userRole?.subscriptionTier}
                </Badge>
              </div>
              <CardHeader className="p-8 pb-4">
                <div className="p-3 w-fit bg-emerald-500/10 rounded-2xl text-emerald-500 border border-emerald-500/20 mb-8 shadow-inner">
                  <CreditCard size={24} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
                    Tradify <span className="text-emerald-500">{userRole?.subscriptionTier === "PRO" ? "Pro" : "Free"}</span>
                  </h3>
                  <div className="flex items-center gap-3 bg-slate-950/40 w-fit px-3 py-1.5 rounded-full border border-slate-800/50">
                    <Clock size={12} className="text-emerald-500" />
                    <span className="text-slate-400 text-[9px] uppercase font-black tracking-widest">Monthly Cycle</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-5">
                  {[
                    { text: userRole?.subscriptionTier === "PRO" ? "Unlimited History" : "30-Day History", active: true },
                    { text: userRole?.subscriptionTier === "PRO" ? "Real-time Sync" : "Standard Sync", active: true },
                    { text: "Priority Support", active: userRole?.subscriptionTier === "PRO" },
                    { text: "Knowledge Base", active: true }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest group/item">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border transition-all",
                        feature.active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-slate-900 border-slate-800 text-slate-700"
                      )}>
                        <CheckCircle2 size={12} />
                      </div>
                      <span className={feature.active ? "text-slate-200" : "text-slate-700"}>{feature.text}</span>
                    </div>
                  ))}
                </div>

                <Button className="w-full bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] h-16 shadow-[0_20px_40px_rgba(255,255,255,0.05)] rounded-2xl transition-all active:scale-95">
                  {userRole?.subscriptionTier === "PRO" ? "Manage Subscription" : "Upgrade Terminal"}
                </Button>
              </CardContent>
            </Card>

            {/* MT5 Status Panel */}
            <Card 
              className="bg-[#0b1120] border-slate-800 group hover:border-emerald-500/30 transition-all cursor-pointer shadow-2xl rounded-3xl relative overflow-hidden active:scale-[0.98]" 
              onClick={() => window.location.href = "/mt5-bridge"}
            >
              <div className="absolute inset-0 bg-emerald-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:scale-110 transition-transform shadow-inner">
                      <Zap size={28} />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-base uppercase tracking-wider italic">MT5 Bridge</h4>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1 opacity-70">Core Engine</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-4 border-slate-900 shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                    mt5Status?.status === "CONNECTED" ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50"
                  )} />
                </div>
                
                <div className="space-y-5 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/50 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Sync Status</span>
                    <span className={mt5Status?.status === "CONNECTED" ? "text-emerald-400" : "text-rose-500"}>
                      {mt5Status?.status === "CONNECTED" ? "ACTIVE" : "OFFLINE"}
                    </span>
                  </div>
                  <div className="w-full h-px bg-slate-800/50" />
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-500">Latency</span>
                    <span className="text-emerald-500/50 font-mono">14ms</span>
                  </div>
                </div>
                
                <div className="mt-8 flex items-center justify-between text-[10px] font-black text-emerald-500 uppercase tracking-widest group-hover:px-2 transition-all">
                  Open Engine Console <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
