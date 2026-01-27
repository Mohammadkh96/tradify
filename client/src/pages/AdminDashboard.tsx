import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, ShieldAlert, Users, CreditCard, Zap, Ban, CheckCircle, Clock, LayoutDashboard, Activity, Plus, Key, Trash2, History } from "lucide-react";
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
import { ThemeToggle } from "@/components/ThemeToggle";

function AdminAccessTab() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");

  const { data: admins, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/access", localStorage.getItem("user_id")],
    queryFn: async () => {
      const userId = localStorage.getItem("user_id");
      const res = await fetch(`/api/admin/access?userId=${userId}`);
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: { email: string; label: string }) => {
      const userId = localStorage.getItem("user_id");
      const res = await apiRequest("POST", `/api/admin/access?userId=${userId}`, data);
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
      const userId = localStorage.getItem("user_id");
      await apiRequest("DELETE", `/api/admin/access/${id}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/access"] });
      toast({ title: "Removed", description: "Access revoked." });
    },
  });

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Shield /> Team Access Control
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Manage Admin Permissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border h-fit lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus size={16} className="text-emerald-500" /> Grant New Access
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Add team members to the Ops Console.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Team Member Email</label>
              <Input 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@tradify.io" 
                className="bg-muted border-border text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Internal Label</label>
              <Input 
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Support Lead" 
                className="bg-muted border-border text-sm"
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

        <Card className="lg:col-span-2 bg-card border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Admin Identity</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Generated Key</TableHead>
                <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Revoke</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.map((admin) => (
                <TableRow key={admin.id} className="border-border hover:bg-muted/40">
                  <TableCell>
                    <div className="font-bold text-foreground">{admin.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{admin.email}</div>
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
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                      onClick={() => deleteMutation.mutate(admin.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {admins?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic text-sm border-0">
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

function AuditLogsTab() {
  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">RETRIEVING AUDIT TRAIL...</div>;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <History /> Operational Audit Log
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Trace Admin Interventions</p>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Admin</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Action</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Target User</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.map((log) => (
              <TableRow key={log.id} className="border-border hover:bg-muted/40">
                <TableCell className="font-bold text-foreground text-xs">{log.adminId}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-500">
                    {log.actionType}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{log.targetUserId}</TableCell>
                <TableCell className="text-muted-foreground text-[10px] font-mono">
                  {log.timestamp ? format(new Date(log.timestamp), "MMM d, HH:mm:ss") : "N/A"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function CreatorApplicationsTab() {
  const { toast } = useToast();
  const { data: apps, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/creator-applications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/creator-applications");
      return res.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("POST", `/api/admin/creator-applications/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator-applications"] });
      toast({ title: "Status Updated", description: "Creator application has been processed." });
    }
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">RETRIEVING APPLICATIONS...</div>;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <ShieldAlert /> Creator Applications
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Approve or Reject Creator Requests</p>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">User ID</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Background</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Focus</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps?.map((app) => (
              <TableRow key={app.id} className="border-border hover:bg-muted/40">
                <TableCell className="font-bold text-foreground text-xs">{app.userId}</TableCell>
                <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{app.background}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{app.contentFocus}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-black uppercase tracking-widest",
                    app.status === "APPROVED" ? "border-emerald-500 text-emerald-500" : 
                    app.status === "REJECTED" ? "border-rose-500 text-rose-500" : "border-amber-500 text-amber-500"
                  )}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {app.status === "PENDING" && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-emerald-500/50 text-emerald-500" 
                        onClick={() => updateStatusMutation.mutate({ id: app.id, status: "APPROVED" })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-500"
                        onClick={() => updateStatusMutation.mutate({ id: app.id, status: "REJECTED" })}>
                        Reject
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

import { useTheme } from "@/components/theme-provider";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [searchEmail, setSearchEmail] = useState("");
  const { theme, setTheme } = useTheme();

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const userId = localStorage.getItem("user_id");
      await apiRequest("DELETE", `/api/admin/users/${targetUserId}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "User Deleted", description: "The user account has been permanently removed." });
    },
  });

  const filteredUsers = users?.filter(u => 
    u.userId.toLowerCase().includes(searchEmail.toLowerCase()) && 
    u.role !== "OWNER"
  ) || [];

  const updateMutation = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string, updates: any }) => {
      const res = await apiRequest("POST", `/api/admin/update-user`, { targetUserId, updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "Success", description: "User record updated and logged." });
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
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
              <LayoutDashboard /> Admin Overview
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Business & System Health</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users size={12} /> Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-foreground">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <CreditCard size={12} /> Active Pro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-500">
                {users?.filter(u => u.subscriptionTier === "PRO").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Zap size={12} /> MT5 Connectors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-500">
                {users?.filter(u => u.syncToken).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
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
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
              <Users /> User Management
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Control Access & Tiers</p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Input 
              placeholder="Search by email..." 
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="bg-muted border-border text-xs w-full md:w-64"
            />
          </div>
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Email/ID</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Plan</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Account Status</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Registered</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="border-border hover:bg-muted/40">
                    <TableCell>
                      <div className="font-mono text-xs text-foreground">{user.userId}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-tighter">{user.role}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.subscriptionTier === "PRO" ? "bg-emerald-500 text-slate-950" : "bg-muted text-muted-foreground"}>
                        {user.subscriptionTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={user.role === "DEACTIVATED" ? "border-rose-500/50 text-rose-500" : "border-emerald-500/50 text-emerald-500"}>
                        {user.role === "DEACTIVATED" ? "DEACTIVATED" : "ACTIVE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground">
                      {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-border hover:bg-muted" 
                        onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { subscriptionTier: user.subscriptionTier === "PRO" ? "FREE" : "PRO" } })}>
                        {user.subscriptionTier === "PRO" ? "Set FREE" : "Grant PRO"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-rose-500 hover:bg-rose-500/10"
                        onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { role: user.role === "DEACTIVATED" ? "TRADER" : "DEACTIVATED" } })}>
                        {user.role === "DEACTIVATED" ? "Reactivate" : "Deactivate"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        onClick={() => {
                          if (confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) {
                            deleteUserMutation.mutate(user.userId);
                          }
                        }}>
                        <Trash2 size={12} className="mr-1" />
                        Delete
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

  // --- 4. AUDIT LOGS PAGE ---
  if (location === "/admin/audit-logs") {
    return <AuditLogsTab />;
  }

  // --- 5. CREATOR APPLICATIONS PAGE ---
  if (location === "/admin/creator-applications") {
    return <CreatorApplicationsTab />;
  }

  // Fallback / Audit Logs / MT5 / Subscriptions (Placeholder style for brevity)
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Activity /> {location.split('/').pop()?.toUpperCase()}
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Module Under Construction</p>
      </div>
      <Card className="bg-card border-border p-12 text-center">
        <Activity size={48} className="mx-auto text-muted-foreground mb-4 animate-pulse" />
        <p className="text-muted-foreground">Full specifications for this tab are being finalized.</p>
      </Card>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
