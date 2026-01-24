import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Shield, Key, Zap, Save, ChevronRight, CheckCircle2, Mail, BadgeCheck, Clock, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-white">
              Operator <span className="text-emerald-500">Profile</span>
            </h1>
            {userRole?.subscriptionTier === "PRO" && (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">PRO OPERATOR</Badge>
            )}
          </div>
          <p className="text-slate-500 text-sm uppercase tracking-[0.2em] font-bold">Terminal Identity & System Config</p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Status</div>
            <div className="text-sm font-bold text-emerald-500 flex items-center gap-2 justify-end">
              <CheckCircle2 size={14} /> Operational
            </div>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Shield size={20} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Essential Info & Security */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personalization & Account */}
          <Card className="bg-[#0b1120] border-slate-800 shadow-2xl">
            <CardHeader className="border-b border-slate-800/50 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <User size={18} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-200">Account Configuration</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Manage your terminal identity and preferences.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Mail size={10} /> Email Identifier
                  </label>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 h-11 flex items-center text-sm font-mono text-slate-400">
                    {userRole?.userId}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <BadgeCheck size={10} /> Account Role
                  </label>
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg px-4 h-11 flex items-center text-sm font-bold text-emerald-500">
                    {userRole?.role}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                  <Input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Operator Name"
                    className="bg-slate-900 border-slate-800 h-11 text-sm focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal Timezone</label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 h-11 text-sm">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="UTC">UTC (London)</SelectItem>
                      <SelectItem value="EST">EST (New York)</SelectItem>
                      <SelectItem value="GST">GST (Dubai)</SelectItem>
                      <SelectItem value="SGT">SGT (Singapore)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="w-full md:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-widest text-[10px] h-11 px-8 gap-2 shadow-lg shadow-emerald-500/10">
                <Save size={14} /> Update Terminal Profile
              </Button>
            </CardContent>
          </Card>

          {/* Security Console */}
          <Card className="bg-[#0b1120] border-slate-800 shadow-xl">
            <CardHeader className="border-b border-slate-800/50 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                  <Key size={18} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-200">Security & Encryption</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Update your access credentials.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-11" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Access Key</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-11" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Key</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-11" />
                </div>
              </div>
              <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-bold uppercase tracking-widest text-[10px] h-11 px-8">
                Rotate Security Keys
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Cards */}
        <div className="space-y-8">
          {/* Subscription Tier */}
          <Card className="bg-gradient-to-br from-slate-900 to-[#0b1120] border-slate-800 overflow-hidden relative group">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <CreditCard size={18} />
                </div>
                <Badge className={userRole?.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}>
                  {userRole?.subscriptionTier}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                  Tradify <span className="text-emerald-500">{userRole?.subscriptionTier === "PRO" ? "Pro" : "Free"}</span>
                </h3>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-2 flex items-center gap-2">
                  <Clock size={10} /> Billing Cycle: Monthly
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  { text: userRole?.subscriptionTier === "PRO" ? "Unlimited Trade History" : "30-Day History Limit", pro: true },
                  { text: userRole?.subscriptionTier === "PRO" ? "1s Real-time MT5 Sync" : "5s Delayed Sync", pro: true },
                  { text: "Priority Execution", pro: true },
                  { text: "Market Knowledge Base", pro: false }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                    <CheckCircle2 size={14} className={feature.pro && userRole?.subscriptionTier !== "PRO" ? "text-slate-700" : "text-emerald-500"} /> 
                    <span className={feature.pro && userRole?.subscriptionTier !== "PRO" ? "text-slate-600" : ""}>{feature.text}</span>
                  </div>
                ))}
              </div>

              <Button className="w-full bg-white hover:bg-slate-200 text-slate-950 font-black uppercase tracking-widest text-xs h-12 shadow-xl shadow-white/5 mt-2">
                {userRole?.subscriptionTier === "PRO" ? "Manage Plan" : "Upgrade Terminal"}
              </Button>
            </CardContent>
          </Card>

          {/* MT5 Status Card */}
          <Card 
            className="bg-[#0b1120] border-slate-800 group hover:border-emerald-500/50 transition-all cursor-pointer shadow-lg" 
            onClick={() => window.location.href = "/mt5-bridge"}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm tracking-tight">MT5 Bridge Status</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Integration Engine</p>
                  </div>
                </div>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  mt5Status?.status === "CONNECTED" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" : "bg-rose-500"
                )} />
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/50">
                <span className="text-slate-500">Current Link</span>
                <span className={mt5Status?.status === "CONNECTED" ? "text-emerald-400 font-bold" : "text-slate-400"}>
                  {mt5Status?.status === "CONNECTED" ? "Live Operational" : "Terminal Offline"}
                </span>
                <ChevronRight size={14} className="text-slate-700 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
