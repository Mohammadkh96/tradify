import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, ShieldAlert, Users, CreditCard, Zap, CheckCircle, LayoutDashboard, Activity, Plus, Key, Trash2, UserPlus, Crown, Sparkles, MessageSquare, ExternalLink, FileText, Pencil, Star, Wifi, WifiOff, Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, formatDistanceToNow, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import ContentStudio from "@/pages/admin/ContentStudio";
import MetaAdsStrategist from "@/pages/admin/MetaAdsStrategist";
import CostIntelligence from "@/pages/admin/CostIntelligence";

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


function EarlyAccessTab() {
  const { data: signups, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/early-access"],
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">LOADING EARLY ACCESS DATA...</div>;

  const pendingCount = signups?.filter(s => s.status === "pending").length || 0;
  const registeredCount = signups?.filter(s => s.status === "registered").length || 0;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-amber-500">
          <Sparkles /> Early Access Signups
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Founding Member Pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-foreground">{signups?.length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Signups</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-amber-500">{pendingCount}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-emerald-500">{registeredCount}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Registered</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Email</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Name</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Signed Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signups?.map((signup) => (
              <TableRow key={signup.id} className="border-border hover:bg-muted/40">
                <TableCell className="font-bold text-foreground text-xs">{signup.email}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{signup.fullName || "-"}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      signup.status === "registered" ? "border-emerald-500/30 text-emerald-500" : "border-amber-500/30 text-amber-500"
                    )}
                  >
                    {signup.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-[10px] font-mono">
                  {signup.createdAt ? format(new Date(signup.createdAt), "MMM d, yyyy") : "N/A"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FoundingMembersTab() {
  const { toast } = useToast();
  const { data: members, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/founding-members"],
  });

  const grantProMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId)}/grant-pro`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founding-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "Pro access granted to founding member." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to grant Pro access." });
    },
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">LOADING FOUNDING MEMBERS...</div>;

  const proMembers = members?.filter(m => m.subscriptionTier === "PRO" || m.subscriptionTier === "ELITE").length || 0;
  const freeMembers = members?.filter(m => m.subscriptionTier === "FREE").length || 0;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-amber-500">
          <Crown /> Founding Members
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Manage Founding Member Benefits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-foreground">{members?.length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total Founders</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-emerald-500">{proMembers}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">With Pro Access</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-amber-500">{freeMembers}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Awaiting Pro Grant</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Email</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Name</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Current Plan</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Joined</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member) => (
              <TableRow key={member.userId} className="border-border hover:bg-muted/40">
                <TableCell className="font-bold text-foreground text-xs flex items-center gap-2">
                  <Crown size={14} className="text-amber-500" />
                  {member.userId}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{member.fullName || "-"}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      member.subscriptionTier === "PRO" || member.subscriptionTier === "ELITE" 
                        ? "border-emerald-500/30 text-emerald-500" 
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {member.subscriptionTier}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-[10px] font-mono">
                  {member.createdAt ? format(new Date(member.createdAt), "MMM d, yyyy") : "N/A"}
                </TableCell>
                <TableCell>
                  {member.subscriptionTier === "FREE" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => grantProMutation.mutate(member.userId)}
                      disabled={grantProMutation.isPending}
                      className="text-xs h-7 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                    >
                      Grant Pro
                    </Button>
                  )}
                  {member.subscriptionTier !== "FREE" && (
                    <span className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Active</span>
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

function SuggestionsTab() {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: suggestions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/founding-suggestions"],
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/founding-suggestions/${id}`, { status, adminNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founding-suggestions"] });
      setEditingId(null);
      setAdminNotes("");
      setSelectedStatus("");
      toast({ title: "Updated", description: "Suggestion status updated." });
    },
  });

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">LOADING SUGGESTIONS...</div>;

  const getUserName = (userId: string) => {
    const user = users?.find(u => u.userId === userId);
    return user?.fullName || userId;
  };

  const statusColors: Record<string, string> = {
    pending: "border-amber-500/30 text-amber-500",
    reviewed: "border-blue-500/30 text-blue-500",
    implemented: "border-emerald-500/30 text-emerald-500",
    declined: "border-rose-500/30 text-rose-500",
  };

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <MessageSquare /> Founding Member Suggestions
        </h1>
        <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Product Feedback Pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-foreground">{suggestions?.length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-amber-500">{suggestions?.filter(s => s.status === "pending").length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-blue-500">{suggestions?.filter(s => s.status === "reviewed").length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Reviewed</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-3xl font-black text-emerald-500">{suggestions?.filter(s => s.status === "implemented").length || 0}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1">Implemented</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {suggestions?.map((suggestion) => (
          <Card key={suggestion.id} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest", statusColors[suggestion.status] || statusColors.pending)}>
                      {suggestion.status}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                      {suggestion.category}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{suggestion.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                  <div className="text-[10px] text-muted-foreground">
                    By <span className="text-foreground font-bold">{getUserName(suggestion.userId)}</span> on {suggestion.createdAt ? format(new Date(suggestion.createdAt), "MMM d, yyyy") : "N/A"}
                  </div>
                  {suggestion.adminNotes && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Admin Notes</div>
                      <p className="text-xs text-foreground">{suggestion.adminNotes}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {editingId === suggestion.id ? (
                    <div className="space-y-2 w-48">
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="implemented">Implemented</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea 
                        placeholder="Admin notes..." 
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="text-xs h-20"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 h-7 text-xs bg-emerald-500 text-slate-950"
                          onClick={() => updateMutation.mutate({ id: suggestion.id, status: selectedStatus || suggestion.status, notes: adminNotes })}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs"
                          onClick={() => { setEditingId(null); setAdminNotes(""); setSelectedStatus(""); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs"
                      onClick={() => { 
                        setEditingId(suggestion.id); 
                        setSelectedStatus(suggestion.status); 
                        setAdminNotes(suggestion.adminNotes || ""); 
                      }}
                    >
                      Update
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!suggestions || suggestions.length === 0) && (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No suggestions yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
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
import ContentLibrary from "@/pages/admin/ContentLibrary";

export default function AdminDashboard() {
  const { toast } = useToast();
  const location = useLocation();
  const [searchEmail, setSearchEmail] = useState("");
  const { theme, setTheme } = useTheme();
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<string>("FREE");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdUserPassword, setCreatedUserPassword] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "all">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: users, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: utmStats } = useQuery<{ leads: any[]; signups: any[] }>({
    queryKey: ["/api/admin/utm-stats"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; subscriptionTier: string }) => {
      const res = await apiRequest("POST", "/api/admin/create-user", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setNewUserEmail("");
      setNewUserPlan("FREE");
      setCreatedUserPassword(data.tempPassword);
      toast({ title: "User Created", description: "New user has been created. Share the temporary password with them." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const userId = localStorage.getItem("user_id");
      await apiRequest("DELETE", `/api/admin/users/${targetUserId}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Deleted", description: "The user account has been permanently removed." });
    },
  });

  const filteredUsers = (users || []).filter(u => {
    if (u.role === "OWNER") return false;
    const searchLower = searchEmail.toLowerCase();
    if (searchLower && !u.userId.toLowerCase().includes(searchLower) && !(u.fullName || "").toLowerCase().includes(searchLower)) return false;
    if (planFilter !== "all" && u.subscriptionTier !== planFilter) return false;
    if (dateFilter !== "all" && u.createdAt) {
      const createdAt = new Date(u.createdAt);
      const now = new Date();
      if (dateFilter === "today" && createdAt < startOfDay(now)) return false;
      if (dateFilter === "week" && createdAt < startOfWeek(now)) return false;
      if (dateFilter === "month" && createdAt < startOfMonth(now)) return false;
    }
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: async ({ targetUserId, updates }: { targetUserId: string, updates: any }) => {
      const res = await apiRequest("POST", `/api/admin/update-user`, { targetUserId, updates });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "User record updated." });
    },
  });

  const toggleFoundingMemberMutation = useMutation({
    mutationFn: async ({ userId, foundingMember }: { userId: string, foundingMember: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId)}/founding-member`, { foundingMember });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founding-members"] });
      toast({ 
        title: "Success", 
        description: variables.foundingMember ? "Founding member status granted." : "Founding member status revoked." 
      });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update founding member status." });
    },
  });

  const grantProAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId)}/grant-pro`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/founding-members"] });
      toast({ title: "Success", description: "Pro access granted." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to grant Pro access." });
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
  if (location.pathname === "/admin/overview") {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
              <LayoutDashboard /> Admin Overview
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Business & System Health</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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
                <Crown size={12} /> Active Elite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-500">
                {users?.filter(u => u.subscriptionTier === "ELITE").length || 0}
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
              <div className="text-3xl font-black text-cyan-500">
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

        <Card className="bg-card border-border" data-testid="card-utm-attribution">
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity size={14} /> Campaign Attribution (UTM)
            </CardTitle>
            <CardDescription className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Leads & signups by campaign source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {utmStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3">Lead Captures</h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Campaign</TableHead>
                        <TableHead className="text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Source</TableHead>
                        <TableHead className="text-right text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utmStats.leads.length > 0 ? utmStats.leads.map((row: any, i: number) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-mono text-xs" data-testid={`text-utm-lead-campaign-${i}`}>
                            <Badge variant="outline" className={row.campaign === "direct" ? "border-muted-foreground/30 text-muted-foreground" : "border-emerald-500/30 text-emerald-500"}>
                              {row.campaign}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.source}</TableCell>
                          <TableCell className="text-right font-black text-foreground">{row.lead_count}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow className="border-border">
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No lead data yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">User Signups</h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Campaign</TableHead>
                        <TableHead className="text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Source</TableHead>
                        <TableHead className="text-right text-muted-foreground font-bold uppercase text-[9px] tracking-widest">Signups</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utmStats.signups.length > 0 ? utmStats.signups.map((row: any, i: number) => (
                        <TableRow key={i} className="border-border">
                          <TableCell className="font-mono text-xs" data-testid={`text-utm-signup-campaign-${i}`}>
                            <Badge variant="outline" className={row.campaign === "direct" ? "border-muted-foreground/30 text-muted-foreground" : "border-blue-400/30 text-blue-400"}>
                              {row.campaign}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.source}</TableCell>
                          <TableCell className="text-right font-black text-foreground">{row.signup_count}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow className="border-border">
                          <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">No signup data yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <Skeleton className="h-32 w-full bg-slate-800" />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- 2. USERS CRM PAGE ---
  if (location.pathname === "/admin/users") {
    const allNonOwners = (users || []).filter(u => u.role !== "OWNER");
    const today = startOfDay(new Date());
    const newToday = allNonOwners.filter(u => u.createdAt && new Date(u.createdAt) >= today).length;
    const mt5Connected = allNonOwners.filter(u => u.mt5Connected).length;
    const paidCount = allNonOwners.filter(u => u.subscriptionTier === "PRO" || u.subscriptionTier === "ELITE").length;

    const planColors: Record<string, string> = {
      ELITE: "bg-amber-500 text-slate-950",
      PRO: "bg-blue-500 text-white",
      FREE: "bg-muted text-muted-foreground",
    };

    const avatarColors: Record<string, string> = {
      ELITE: "bg-amber-500/20 text-amber-500 border border-amber-500/30",
      PRO: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      FREE: "bg-muted text-muted-foreground border border-border",
    };

    const getInitials = (userId: string, fullName?: string) => {
      if (fullName) {
        const parts = fullName.trim().split(" ");
        return parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
      }
      const email = userId.includes("@") ? userId : userId;
      return email.slice(0, 2).toUpperCase();
    };

    const getCountryFlag = (country: string | null | undefined): string => {
      if (!country) return "";
      const code = country.trim().toUpperCase();
      if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
        return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
      }
      return "🌍";
    };

    const handleSort = (field: string) => {
      if (sortField === field) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    };

    const SortIcon = ({ field }: { field: string }) => {
      if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 ml-1 inline" />;
      return sortDir === "asc"
        ? <ChevronUp size={11} className="text-emerald-500 ml-1 inline" />
        : <ChevronDown size={11} className="text-emerald-500 ml-1 inline" />;
    };

    const sortedUsers = [...filteredUsers].sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === "createdAt") {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (sortField === "name") {
        aVal = (a.fullName || a.userId || "").toLowerCase();
        bVal = (b.fullName || b.userId || "").toLowerCase();
      } else if (sortField === "plan") {
        const order: Record<string, number> = { ELITE: 3, PRO: 2, FREE: 1 };
        aVal = order[a.subscriptionTier] || 0;
        bVal = order[b.subscriptionTier] || 0;
      } else if (sortField === "mt5") {
        aVal = a.mt5Connected ? 1 : 0;
        bVal = b.mt5Connected ? 1 : 0;
      } else {
        aVal = a[sortField] ?? "";
        bVal = b[sortField] ?? "";
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return (
      <div className="p-8 space-y-6 bg-background min-h-screen text-foreground">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
              <Users /> User CRM
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Member Intelligence & Access Control</p>
          </div>
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
            data-testid="button-create-user"
          >
            <UserPlus size={14} className="mr-2" />
            Create User
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border" data-testid="card-stat-total">
            <CardContent className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <Users size={10} /> Total Users
              </div>
              <div className="text-3xl font-black text-foreground">{allNonOwners.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="card-stat-new-today">
            <CardContent className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <UserPlus size={10} /> New Today
              </div>
              <div className="text-3xl font-black text-emerald-500">{newToday}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="card-stat-mt5">
            <CardContent className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <Zap size={10} /> MT5 Connected
              </div>
              <div className="text-3xl font-black text-cyan-400">{mt5Connected}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border" data-testid="card-stat-paid">
            <CardContent className="p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                <CreditCard size={10} /> Paid Subscribers
              </div>
              <div className="text-3xl font-black text-blue-400">{paidCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1 border border-border">
            {(["today", "week", "month", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                data-testid={`button-date-filter-${f}`}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors",
                  dateFilter === f ? "bg-emerald-500 text-slate-950" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "today" ? "Today" : f === "week" ? "This Week" : f === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-9 w-36 text-xs bg-muted border-border" data-testid="select-plan-filter">
              <SelectValue placeholder="All Plans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plans</SelectItem>
              <SelectItem value="FREE">Free</SelectItem>
              <SelectItem value="PRO">Pro</SelectItem>
              <SelectItem value="ELITE">Elite</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="bg-muted border-border text-xs pl-8 h-9"
              data-testid="input-search-users"
            />
          </div>
        </div>

        {createdUserPassword && (
          <Card className="bg-emerald-500/10 border-emerald-500/30 border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-emerald-500">
                <CheckCircle size={16} /> User Created Successfully
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Share the temporary password below with the new user. They should change it after first login.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-background/50 p-4 rounded-lg border border-border">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Temporary Password</label>
                <div className="flex items-center gap-3">
                  <code className="text-lg font-mono font-bold text-foreground bg-muted px-4 py-2 rounded" data-testid="text-temp-password">
                    {createdUserPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      navigator.clipboard.writeText(createdUserPassword);
                      toast({ title: "Copied", description: "Password copied to clipboard" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="text-xs text-muted-foreground"
                onClick={() => {
                  setCreatedUserPassword(null);
                  setShowCreateForm(false);
                }}
              >
                Done
              </Button>
            </CardContent>
          </Card>
        )}

        {showCreateForm && !createdUserPassword && (
          <Card className="bg-card border-emerald-500/20 border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <UserPlus size={16} className="text-emerald-500" /> Create New User
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Manually create a user account for testing, partnerships, or early access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Address</label>
                  <Input 
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com" 
                    className="bg-muted border-border text-sm"
                    data-testid="input-new-user-email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Plan Tier</label>
                  <Select value={newUserPlan} onValueChange={setNewUserPlan}>
                    <SelectTrigger className="bg-muted border-border" data-testid="select-new-user-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FREE">Free</SelectItem>
                      <SelectItem value="PRO">Pro ($29/mo)</SelectItem>
                      <SelectItem value="ELITE">Elite ($59/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button 
                  className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                  onClick={() => createUserMutation.mutate({ email: newUserEmail, subscriptionTier: newUserPlan })}
                  disabled={createUserMutation.isPending || !newUserEmail}
                  data-testid="button-submit-create-user"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
                <Button 
                  variant="ghost" 
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewUserEmail("");
                    setNewUserPlan("FREE");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border">
                  <TableHead className="pl-4">
                    <button onClick={() => handleSort("name")} className="flex items-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest hover:text-foreground cursor-pointer">
                      Member <SortIcon field="name" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("plan")} className="flex items-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest hover:text-foreground cursor-pointer">
                      Plan <SortIcon field="plan" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("mt5")} className="flex items-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest hover:text-foreground cursor-pointer">
                      MT5 <SortIcon field="mt5" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("createdAt")} className="flex items-center text-muted-foreground font-bold uppercase text-[10px] tracking-widest hover:text-foreground cursor-pointer">
                      Joined <SortIcon field="createdAt" />
                    </button>
                  </TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Country</TableHead>
                  <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Source</TableHead>
                  <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id} className="border-border hover:bg-muted/40" data-testid={`row-user-${user.userId}`}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center text-xs font-black shrink-0", avatarColors[user.subscriptionTier] || avatarColors.FREE)}>
                          {getInitials(user.userId, user.fullName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="font-semibold text-xs text-foreground truncate max-w-[160px]">
                              {user.fullName || user.userId}
                            </div>
                            {user.foundingMember && (
                              <Star size={11} className="text-amber-500 shrink-0" fill="currentColor" />
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]">
                            {user.fullName ? user.userId : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] font-black uppercase tracking-widest", planColors[user.subscriptionTier] || planColors.FREE)}>
                        {user.subscriptionTier === "ELITE" && <Crown size={9} className="mr-1" />}
                        {user.subscriptionTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.mt5Connected ? (
                        <div className="flex items-center gap-1.5 text-emerald-500">
                          <Wifi size={12} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Connected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground/50">
                          <WifiOff size={12} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Not Connected</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.country ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-base leading-none">{getCountryFlag(user.country)}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{user.country}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.utmSource ? (
                        <Badge variant="outline" className="text-[9px] font-bold border-blue-500/20 text-blue-400 uppercase tracking-widest">
                          {user.utmSource}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Select 
                          value={user.subscriptionTier} 
                          onValueChange={(tier) => updateMutation.mutate({ targetUserId: user.userId, updates: { subscriptionTier: tier } })}
                        >
                          <SelectTrigger className="h-7 w-24 text-[10px] bg-muted border-border" data-testid={`select-plan-${user.userId}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FREE">Free</SelectItem>
                            <SelectItem value="PRO">Pro</SelectItem>
                            <SelectItem value="ELITE">Elite</SelectItem>
                          </SelectContent>
                        </Select>
                        {user.subscriptionTier === "FREE" && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-500 hover:bg-emerald-500/10"
                            onClick={() => grantProAdminMutation.mutate(user.userId)}
                            disabled={grantProAdminMutation.isPending}
                            data-testid={`button-grant-pro-${user.userId}`}
                          >
                            Grant Pro
                          </Button>
                        )}
                        <Button size="sm" variant="ghost"
                          className={cn("h-7 text-[10px]", user.foundingMember ? "text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground hover:bg-muted/60")}
                          onClick={() => toggleFoundingMemberMutation.mutate({ userId: user.userId, foundingMember: !user.foundingMember })}
                          disabled={toggleFoundingMemberMutation.isPending}
                          title={user.foundingMember ? "Revoke Founding Member" : "Grant Founding Member"}
                          data-testid={`button-toggle-founder-${user.userId}`}
                        >
                          <Star size={12} fill={user.foundingMember ? "currentColor" : "none"} className="mr-1" />
                          {user.foundingMember ? "Founder" : "Founder"}
                        </Button>
                        <Button size="sm" variant="ghost" className={cn("h-7 text-[10px]", user.role === "DEACTIVATED" ? "text-emerald-500 hover:bg-emerald-500/10" : "text-rose-500 hover:bg-rose-500/10")}
                          onClick={() => updateMutation.mutate({ targetUserId: user.userId, updates: { role: user.role === "DEACTIVATED" ? "TRADER" : "DEACTIVATED" } })}
                          data-testid={`button-toggle-status-${user.userId}`}
                        >
                          {user.role === "DEACTIVATED" ? "Reactivate" : "Deactivate"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                          onClick={() => {
                            if (confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) {
                              deleteUserMutation.mutate(user.userId);
                            }
                          }}
                          data-testid={`button-delete-${user.userId}`}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground italic text-sm">
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- 3. ADMIN ACCESS PAGE ---
  if (location.pathname === "/admin/access") {
    return <AdminAccessTab />;
  }


  // --- 5. CREATOR APPLICATIONS PAGE ---
  if (location.pathname === "/admin/creator-applications") {
    return <CreatorApplicationsTab />;
  }

  // --- 6. EARLY ACCESS PAGE ---
  if (location.pathname === "/admin/early-access") {
    return <EarlyAccessTab />;
  }

  // --- 7. FOUNDING MEMBERS PAGE ---
  if (location.pathname === "/admin/founding-members") {
    return <FoundingMembersTab />;
  }

  // --- 8. SUGGESTIONS PAGE ---
  if (location.pathname === "/admin/suggestions") {
    return <SuggestionsTab />;
  }

  // --- 9. CONTENT STUDIO PAGE ---
  if (location.pathname === "/admin/marketing/content-studio") {
    return <ContentStudio />;
  }

  // --- 10. META ADS STRATEGIST PAGE ---
  if (location.pathname === "/admin/marketing/meta-ads") {
    return <MetaAdsStrategist />;
  }

  // --- 11. BLOG MANAGEMENT PAGE ---
  if (location.pathname === "/admin/blog") {
    return <AdminBlogTab />;
  }

  // --- 13. CONTENT LIBRARY PAGE ---
  if (location.pathname === "/admin/marketing/content-library") {
    return <ContentLibrary />;
  }

  // --- 14. COST INTELLIGENCE PAGE ---
  if (location.pathname === "/admin/costs") {
    return <CostIntelligence />;
  }

  // Fallback / Audit Logs / MT5 / Subscriptions (Placeholder style for brevity)
  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
          <Activity /> {location.pathname.split('/').pop()?.toUpperCase()}
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

function AdminBlogTab() {
  const { toast } = useToast();
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    category: "Trading Psychology",
    excerpt: "",
    content: "",
    coverImage: "",
    metaTitle: "",
    metaDescription: "",
    tags: "",
    status: "draft",
  });

  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/blog"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/blog", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      resetForm();
      toast({ title: "Success", description: "Blog post created." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to create post." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/blog/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      resetForm();
      toast({ title: "Updated", description: "Blog post updated." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update post." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/blog/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Deleted", description: "Blog post deleted." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete post." });
    },
  });

  const resetForm = () => {
    setEditingPost(null);
    setIsCreating(false);
    setFormData({
      title: "",
      slug: "",
      category: "Trading Psychology",
      excerpt: "",
      content: "",
      coverImage: "",
      metaTitle: "",
      metaDescription: "",
      tags: "",
      status: "draft",
    });
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      title: value,
      slug: editingPost ? prev.slug : generateSlug(value),
    }));
  };

  const startEdit = (post: any) => {
    setEditingPost(post);
    setIsCreating(false);
    setFormData({
      title: post.title || "",
      slug: post.slug || "",
      category: post.category || "Trading Psychology",
      excerpt: post.excerpt || "",
      content: post.content || "",
      coverImage: post.coverImage || "",
      metaTitle: post.metaTitle || "",
      metaDescription: post.metaDescription || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : post.tags || "",
      status: post.status || "draft",
    });
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      tags: formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this blog post?")) {
      deleteMutation.mutate(id);
    }
  };

  const showForm = isCreating || editingPost;

  if (isLoading) return <div className="p-8 text-emerald-500 font-mono">LOADING BLOG POSTS...</div>;

  if (showForm) {
    return (
      <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
              <FileText /> {editingPost ? "Edit Post" : "New Post"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">
              {editingPost ? "Update blog post details" : "Create a new blog post"}
            </p>
          </div>
          <Button variant="outline" onClick={resetForm} data-testid="button-cancel-blog">
            Back to List
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Post title"
                  className="bg-muted border-border"
                  data-testid="input-blog-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Slug</label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="post-url-slug"
                  className="bg-muted border-border"
                  data-testid="input-blog-slug"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Category</label>
                <Select value={formData.category} onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}>
                  <SelectTrigger className="bg-muted border-border" data-testid="select-blog-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Trading Psychology">Trading Psychology</SelectItem>
                    <SelectItem value="Prop Firm Tips">Prop Firm Tips</SelectItem>
                    <SelectItem value="Strategy Building">Strategy Building</SelectItem>
                    <SelectItem value="Platform Updates">Platform Updates</SelectItem>
                    <SelectItem value="Risk Management">Risk Management</SelectItem>
                    <SelectItem value="Market Analysis">Market Analysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</label>
                <Select value={formData.status} onValueChange={(val) => setFormData((prev) => ({ ...prev, status: val }))}>
                  <SelectTrigger className="bg-muted border-border" data-testid="select-blog-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Excerpt</label>
              <Textarea
                value={formData.excerpt}
                onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Brief summary of the post"
                className="bg-muted border-border"
                rows={3}
                data-testid="textarea-blog-excerpt"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Content (Markdown)</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Write your blog post content in markdown..."
                className="bg-muted border-border font-mono text-sm"
                rows={16}
                data-testid="textarea-blog-content"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cover Image URL (optional)</label>
                <Input
                  value={formData.coverImage}
                  onChange={(e) => setFormData((prev) => ({ ...prev, coverImage: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="bg-muted border-border"
                  data-testid="input-blog-cover-image"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tags (comma-separated)</label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="trading, psychology, discipline"
                  className="bg-muted border-border"
                  data-testid="input-blog-tags"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Meta Title (optional, SEO)</label>
                <Input
                  value={formData.metaTitle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metaTitle: e.target.value }))}
                  placeholder="SEO title"
                  className="bg-muted border-border"
                  data-testid="input-blog-meta-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Meta Description (optional, SEO)</label>
                <Textarea
                  value={formData.metaDescription}
                  onChange={(e) => setFormData((prev) => ({ ...prev, metaDescription: e.target.value }))}
                  placeholder="SEO description"
                  className="bg-muted border-border"
                  rows={2}
                  data-testid="textarea-blog-meta-description"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <Button variant="outline" onClick={resetForm} data-testid="button-blog-cancel">
                Cancel
              </Button>
              <Button
                className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.title || !formData.slug}
                data-testid="button-blog-save"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingPost ? "Update Post" : "Create Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen text-foreground">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3 text-emerald-500">
            <FileText /> Blog Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-bold">Create and manage blog posts</p>
        </div>
        <Button
          className="bg-emerald-500 text-slate-950 font-bold uppercase tracking-widest text-xs"
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          data-testid="button-new-blog-post"
        >
          <Plus size={16} className="mr-2" /> New Post
        </Button>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Title</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Category</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Published</TableHead>
              <TableHead className="text-right text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts?.map((post) => (
              <TableRow key={post.id} className="border-border hover:bg-muted/40">
                <TableCell>
                  <div className="font-bold text-foreground text-sm">{post.title}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">/{post.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-muted-foreground/30 text-muted-foreground">
                    {post.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      post.status === "published" ? "border-emerald-500/30 text-emerald-500" : "border-amber-500/30 text-amber-500"
                    )}
                  >
                    {post.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-[10px] font-mono">
                  {post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : post.createdAt ? format(new Date(post.createdAt), "MMM d, yyyy") : "N/A"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(post)}
                      data-testid={`button-edit-blog-${post.id}`}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-rose-500"
                      onClick={() => handleDelete(post.id)}
                      data-testid={`button-delete-blog-${post.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!posts || posts.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-sm border-0">
                  No blog posts yet. Click "New Post" to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

