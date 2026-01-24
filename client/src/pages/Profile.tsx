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
    <div className="p-6 md:p-8 space-y-8 bg-[#020617] min-h-screen text-slate-50 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/50 pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
              Operator <span className="text-emerald-500">Profile</span>
            </h1>
            {userRole?.subscriptionTier === "PRO" && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-0.5 text-[10px] font-black tracking-widest uppercase">
                PRO OPERATOR
              </Badge>
            )}
          </div>
          <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-black">System Identity & Terminal Config</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[#0b1120] p-3 px-5 rounded-xl border border-slate-800 shadow-xl">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">System Status</div>
            <div className="text-xs font-black text-emerald-500 flex items-center gap-2 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </div>
          </div>
          <div className="w-px h-10 bg-slate-800" />
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <Shield size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Essential Info & Security */}
        <div className="lg:col-span-8 space-y-8">
          {/* Account Identity */}
          <Card className="bg-[#0b1120] border-slate-800/80 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="border-b border-slate-800/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/10">
                  <User size={18} />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-200">Terminal Identity</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Manage your operator credentials</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Mail size={12} className="text-emerald-500/50" /> Operator Email
                  </label>
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl px-4 h-12 flex items-center text-sm font-mono text-slate-400 group-hover:border-slate-700 transition-colors">
                    {userRole?.userId}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <BadgeCheck size={12} className="text-emerald-500/50" /> Terminal Access
                  </label>
                  <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl px-4 h-12 flex items-center text-sm font-black text-emerald-500 uppercase tracking-widest">
                    {userRole?.role}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator Alias</label>
                  <Input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter Alias"
                    className="bg-slate-950 border-slate-800/50 h-12 text-sm font-medium focus:border-emerald-500/50 focus:ring-emerald-500/10 transition-all rounded-xl"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Timezone</label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-slate-950 border-slate-800/50 h-12 text-sm font-medium rounded-xl hover:border-slate-700 transition-colors">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="UTC">UTC (Universal)</SelectItem>
                      <SelectItem value="EST">EST (New York)</SelectItem>
                      <SelectItem value="GST">GST (Dubai)</SelectItem>
                      <SelectItem value="SGT">SGT (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-widest text-[10px] h-12 px-10 gap-2 shadow-2xl shadow-emerald-500/20 rounded-xl transition-all active:scale-[0.98]">
                  <Save size={14} /> Commit Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Console */}
          <Card className="bg-[#0b1120] border-slate-800/80 shadow-xl overflow-hidden group">
            <CardHeader className="border-b border-slate-800/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/10">
                  <Key size={18} />
                </div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-200">Security Encryption</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Update access keys</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Master Key (Current)</label>
                <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Terminal Key</label>
                  <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confirm Key</label>
                  <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
                </div>
              </div>
              <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl transition-all">
                Rotate Security Keys
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Cards */}
        <div className="lg:col-span-4 space-y-8">
          {/* Subscription Tier */}
          <Card className="bg-gradient-to-br from-slate-900 to-[#0b1120] border-slate-800/80 overflow-hidden relative group shadow-2xl">
            <div className="absolute inset-0 bg-emerald-500/[0.03] pointer-events-none" />
            <div className="absolute top-0 right-0 p-4">
              <Badge className={cn(
                "font-black text-[10px] uppercase tracking-widest px-3 py-1",
                userRole?.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
              )}>
                {userRole?.subscriptionTier}
              </Badge>
            </div>
            <CardHeader className="pb-4 pt-8">
              <div className="p-2.5 w-fit bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/10 mb-4">
                <CreditCard size={22} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                  Tradify <span className="text-emerald-500">{userRole?.subscriptionTier === "PRO" ? "Pro" : "Free"}</span>
                </h3>
                <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] mt-3 flex items-center gap-2">
                  <Clock size={12} className="text-slate-700" /> Billed Monthly
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-4 pb-8">
              <div className="space-y-4">
                {[
                  { text: userRole?.subscriptionTier === "PRO" ? "Unlimited History" : "30-Day Limit", active: true },
                  { text: userRole?.subscriptionTier === "PRO" ? "Real-time MT5 Sync" : "Delayed Sync", active: true },
                  { text: "Priority Execution", active: userRole?.subscriptionTier === "PRO" },
                  { text: "Market Knowledge Base", active: true }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 size={16} className={feature.active ? "text-emerald-500" : "text-slate-800"} /> 
                    <span className={feature.active ? "text-slate-300" : "text-slate-700"}>{feature.text}</span>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-widest text-xs h-14 shadow-2xl shadow-white/5 mt-4 transition-all active:scale-[0.98] rounded-xl">
                {userRole?.subscriptionTier === "PRO" ? "Manage Subscription" : "Upgrade Terminal"}
              </Button>
            </CardContent>
          </Card>

          {/* MT5 Status Card */}
          <Card 
            className="bg-[#0b1120] border-slate-800/80 group hover:border-emerald-500/50 transition-all cursor-pointer shadow-xl rounded-2xl relative overflow-hidden" 
            onClick={() => window.location.href = "/mt5-bridge"}
          >
            <div className="absolute inset-0 bg-emerald-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/10 group-hover:scale-110 transition-transform">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm uppercase tracking-wider">MT5 Bridge</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Integration Core</p>
                  </div>
                </div>
                <div className={cn(
                  "w-3 h-3 rounded-full border-2 border-slate-900 shadow-2xl",
                  mt5Status?.status === "CONNECTED" ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500"
                )} />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest pb-4 border-b border-slate-800/50">
                  <span className="text-slate-500">Signal Status</span>
                  <span className={mt5Status?.status === "CONNECTED" ? "text-emerald-400" : "text-rose-500"}>
                    {mt5Status?.status === "CONNECTED" ? "SYNCHRONIZED" : "LINK BROKEN"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-500">Latency</span>
                  <span className="text-slate-400">14ms</span>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest group-hover:gap-4 transition-all">
                Access Engine Console <ChevronRight size={14} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
