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
    <div className="flex-1 overflow-y-auto bg-[#020617] text-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-10 py-12 space-y-12">
        {/* Page Header */}
        <div className="space-y-2 border-b border-slate-800/50 pb-8">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">
            Profile
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-70">
            Manage your account, security, and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* LEFT COLUMN (70%) — USER CONTROLS */}
          <div className="lg:col-span-8 space-y-10">
            
            {/* SECTION 1: ACCOUNT IDENTITY (READ-ONLY) */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 ml-1">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 border border-emerald-500/20">
                  <User size={18} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Account</h2>
              </div>
              <Card className="bg-[#0b1120] border-slate-800 shadow-xl rounded-2xl">
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl px-4 h-12 flex items-center text-sm font-mono text-slate-400">
                      {userRole?.userId}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator Role</label>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl px-4 h-12 flex items-center text-sm font-black text-emerald-500 uppercase tracking-widest">
                      {userRole?.role || "TRADER"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* SECTION 2: PERSONAL PREFERENCES (EDITABLE) */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 ml-1">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 border border-blue-500/20">
                  <BadgeCheck size={18} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Preferences</h2>
              </div>
              <Card className="bg-[#0b1120] border-slate-800 shadow-xl rounded-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                      <Input 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="ENTER NAME"
                        className="bg-slate-950 border-slate-800/50 h-12 text-sm font-bold uppercase tracking-wider rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Terminal Timezone</label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="bg-slate-950 border-slate-800/50 h-12 text-sm font-bold uppercase tracking-wider rounded-xl">
                          <SelectValue placeholder="SELECT TIMEZONE" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="UTC" className="uppercase text-[10px] font-black tracking-widest">UTC (Universal)</SelectItem>
                          <SelectItem value="EST" className="uppercase text-[10px] font-black tracking-widest">EST (New York)</SelectItem>
                          <SelectItem value="GST" className="uppercase text-[10px] font-black tracking-widest">GST (Dubai)</SelectItem>
                          <SelectItem value="SGT" className="uppercase text-[10px] font-black tracking-widest">SGT (Singapore)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] h-11 px-8 rounded-xl shadow-lg shadow-emerald-500/10">
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </section>

            {/* SECTION 3: SECURITY */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 ml-1">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
                  <Shield size={18} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Security</h2>
              </div>
              <Card className="bg-[#0b1120] border-slate-800 shadow-xl rounded-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Password</label>
                    <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Password</label>
                      <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confirm Password</label>
                      <Input type="password" placeholder="••••••••••••" className="bg-slate-950 border-slate-800/50 h-12 rounded-xl" />
                    </div>
                  </div>
                  <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] h-11 px-8 rounded-xl">
                    Update Password
                  </Button>
                </CardContent>
              </Card>
            </section>

            {/* SECTION 4: MT5 CONNECTION (REFERENCE ONLY) */}
            <section className="space-y-6">
              <div className="flex items-center gap-3 ml-1">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500 border border-purple-500/20">
                  <Zap size={18} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">MT5 Connection</h2>
              </div>
              <Card className="bg-[#0b1120] border-slate-800 shadow-xl rounded-2xl">
                <CardContent className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection Status</label>
                      <div className="flex items-center gap-2 h-12 px-4 bg-slate-950/50 border border-slate-800/50 rounded-xl">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          mt5Status?.status === "CONNECTED" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                        )} />
                        <span className="text-xs font-black uppercase tracking-widest">
                          {mt5Status?.status === "CONNECTED" ? "Synchronized" : "Disconnected"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Terminal Sync</label>
                      <div className="h-12 px-4 bg-slate-950/50 border border-slate-800/50 rounded-xl flex items-center text-xs font-mono text-slate-400">
                        {mt5Status?.lastSync ? new Date(mt5Status.lastSync).toLocaleString() : "NEVER"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] h-11 px-8 rounded-xl">
                      Reset Sync Token
                    </Button>
                    <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] h-11 px-8 rounded-xl">
                      Reconnect Engine
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* RIGHT COLUMN (30%) — PLAN & BILLING */}
          <div className="lg:col-span-4 sticky top-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3 ml-1">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500 border border-emerald-500/20">
                  <CreditCard size={18} />
                </div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Your Plan</h2>
              </div>
              <Card className="bg-gradient-to-b from-[#111827] to-[#0b1120] border-slate-800 shadow-2xl rounded-2xl overflow-hidden relative">
                <div className="absolute top-4 right-4">
                  <Badge className={cn(
                    "font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded-full",
                    userRole?.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  )}>
                    {userRole?.subscriptionTier || "FREE"}
                  </Badge>
                </div>
                <CardContent className="p-8 space-y-8">
                  <div>
                    <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none mb-2">
                      Tradify <span className="text-emerald-500">{userRole?.subscriptionTier === "PRO" ? "Pro" : "Free"}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">
                      <Clock size={12} className="text-slate-700" /> Billed Monthly
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { text: userRole?.subscriptionTier === "PRO" ? "Unlimited History" : "30-Day Limit", active: true },
                      { text: userRole?.subscriptionTier === "PRO" ? "Real-time Sync" : "Standard Sync", active: true },
                      { text: "Priority Execution", active: userRole?.subscriptionTier === "PRO" },
                      { text: "Knowledge Base", active: true }
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest">
                        <CheckCircle2 size={14} className={feature.active ? "text-emerald-500" : "text-slate-800"} /> 
                        <span className={feature.active ? "text-slate-300" : "text-slate-700"}>{feature.text}</span>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-[0.2em] text-[10px] h-14 rounded-xl shadow-xl">
                    {userRole?.subscriptionTier === "PRO" ? "Manage Subscription" : "Upgrade Terminal"}
                  </Button>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
