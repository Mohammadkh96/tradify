import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, ShieldAlert, Users, CreditCard, Zap, Ban, CheckCircle, Clock, LayoutDashboard, Activity, Plus, Key, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useState } from "react";

function AdminAccessTab() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");

  const { data: admins, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/access"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { email: string; label: string }) => {
      const res = await apiRequest("POST", "/api/admin/access", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access"] });
      setEmail("");
      setLabel("");
      toast({ title: "Success", description: "Admin access granted." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/access/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access"] });
      toast({ title: "Removed", description: "Access revoked." });
    },
  });

  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Shield /> Team Access Control
        </h1>
        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Manage Admin Permissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-[#0b1120] border-slate-800 h-fit lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus size={16} className="text-emerald-500" /> Grant New Access
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">Add team members to the Ops Console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Member Email</label>
              <Input 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@tradify.io" 
                className="bg-slate-900 border-slate-800 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Internal Label</label>
              <Input 
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Support Lead" 
                className="bg-slate-900 border-slate-800 text-sm"
              />
            </div>
            <Button 
              className="w-full bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs h-10 mt-2"
              onClick={() => addMutation.mutate({ email, label })}
              disabled={addMutation.isPending || !email}
            >
              {addMutation.isPending ? "Generating Key..." : "Grant Ops Access"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-[#0b1120] border-slate-800 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Admin Identity</TableHead>
                <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Generated Key</TableHead>
                <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Revoke</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.map((admin) => (
                <TableRow key={admin.id} className="border-slate-800 hover:bg-slate-900/40">
                  <TableCell>
                    <div className="font-bold text-slate-200">{admin.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{admin.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 w-fit">
                      <Key size={10} /> {admin.accessKey}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-slate-600 hover:text-rose-500"
                      onClick={() => deleteMutation.mutate(admin.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {admins?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-32 text-center text-slate-600 italic text-sm border-0">
                    No team members added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [location] = useLocation();

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string, updates: any }) => {
      const res = await apiRequest("POST", "/api/admin/update-user", { targetUserId, updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User updated successfully." });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-[400px] w-full bg-slate-800" />
      </div>
    );
  }

  // --- 1. OVERVIEW PAGE ---
  if (location === "/admin/overview") {
    return (
      <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
            <LayoutDashboard /> Admin Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Business & System Health</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Users size={12} /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-white">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <CreditCard size={12} /> Active Pro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-500">
                {users?.filter(u => u.subscriptionTier === "PRO").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Zap size={12} /> MT5 Connectors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-500">
                {users?.filter(u => u.syncToken).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[#0b1120] border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <ShieldAlert size={12} /> API Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-emerald-500 flex items-center gap-2">
                <CheckCircle size={16} /> Operational
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- 2. USERS MANAGEMENT PAGE ---
  if (location === "/admin/users") {
    return (
      <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
            <Users /> User Management
          </h1>
          <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Control Access & Tiers</p>
        </div>

        <Card className="bg-[#0b1120] border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-900/30">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Email/ID</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Role</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Plan</TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">MT5</TableHead>
                  <TableHead className="text-right text-slate-500 font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} className="border-slate-800 hover:bg-slate-900/40">
                    <TableCell className="font-mono text-xs text-slate-400">{user.userId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={user.role === "OWNER" ? "text-rose-500 border-rose-500/30" : "text-slate-500"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}>
                        {user.subscriptionTier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-slate-600">
                      {user.syncToken ? "CONNECTED" : "OFFLINE"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" 
                        onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { subscriptionTier: user.subscriptionTier === "PRO" ? "FREE" : "PRO" } })}>
                        {user.subscriptionTier === "PRO" ? "Set FREE" : "Grant PRO"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- 3. ADMIN ACCESS PAGE ---
  if (location === "/admin/access") {
    return <AdminAccessTab />;
  }

  // Fallback / Audit Logs / MT5 / Subscriptions (Placeholder style for brevity)
  return (
    <div className="p-8 space-y-8 bg-slate-950 min-h-screen text-slate-50">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Activity /> {location.split('/').pop()?.toUpperCase()}
        </h1>
        <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">Module Under Construction</p>
      </div>
      <Card className="bg-[#0b1120] border-slate-800 p-12 text-center">
        <Activity size={48} className="mx-auto text-slate-800 mb-4 animate-pulse" />
        <p className="text-slate-500">Full specifications for this tab are being finalized.</p>
      </Card>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
