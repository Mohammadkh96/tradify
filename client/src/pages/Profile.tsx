import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Shield, Key, Zap, Globe, Save, ChevronRight, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 bg-slate-800" />
          <Skeleton className="h-48 bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-[#020617] min-h-screen text-slate-50">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <User /> Operator Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Identity & System Configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Account & Profile */}
        <div className="lg:col-span-7 space-y-8">
          {/* Core Identity */}
          <Card className="bg-[#0b1120] border-slate-800 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
              <Badge className={userRole?.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}>
                {userRole?.subscriptionTier} ACCOUNT
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Shield size={12} className="text-emerald-500" /> Core Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Email Terminal</label>
                  <p className="text-sm font-mono text-slate-300">{userRole?.userId || "Unknown"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Access Role</label>
                  <p className="text-sm font-bold text-emerald-500/80">{userRole?.role || "TRADER"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Member Since</label>
                  <p className="text-sm text-slate-400">Jan 2026</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personalization */}
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader>
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <User size={12} className="text-emerald-500" /> Personalization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Display Name</label>
                  <Input 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter operator name"
                    className="bg-slate-900 border-slate-800 h-10 text-sm focus:ring-emerald-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Timezone</label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 h-10 text-sm">
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
                <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-widest text-[10px] h-9 gap-2">
                  <Save size={14} /> Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader>
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Key size={12} className="text-emerald-500" /> Security Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-10" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New</label>
                  <Input type="password" placeholder="••••••••" className="bg-slate-900 border-slate-800 h-10" />
                </div>
              </div>
              <Button variant="outline" className="border-slate-800 hover:bg-slate-900 text-slate-400 font-bold uppercase tracking-widest text-[10px] h-9">
                Update Security Credentials
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status & Subscription */}
        <div className="lg:col-span-5 space-y-8">
          {/* Subscription Status */}
          <Card className="bg-gradient-to-br from-[#0b1120] to-[#020617] border-slate-800 border-l-4 border-l-emerald-500">
            <CardHeader>
              <CardTitle className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <CreditCard size={12} className="text-emerald-500" /> Subscription Tier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                  Tradify {userRole?.subscriptionTier === "PRO" ? "Pro" : "Free"}
                </h3>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mt-1">
                  {userRole?.subscriptionTier === "PRO" ? "Institutional Access Active" : "Limited Terminal Access"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-500" /> 
                  {userRole?.subscriptionTier === "PRO" ? "Unlimited Trade History" : "30-Day History Limit"}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  {userRole?.subscriptionTier === "PRO" ? "1s Real-time MT5 Sync" : "5s Delayed Sync"}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Priority Cloud Execution
                </div>
              </div>

              <Button className="w-full bg-slate-100 hover:bg-white text-slate-950 font-black uppercase tracking-widest text-xs h-11">
                {userRole?.subscriptionTier === "PRO" ? "Manage Subscription" : "Upgrade to Pro Terminal"}
              </Button>
            </CardContent>
          </Card>

          {/* MT5 Bridge Link */}
          <Card className="bg-[#0b1120] border-slate-800 group hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={() => window.location.href = "/mt5-bridge"}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">MT5 Bridge Status</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {mt5Status?.status === "CONNECTED" ? "Link Operational" : "Terminal Offline"}
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-700 group-hover:text-emerald-500 transition-colors" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CreditCard(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
