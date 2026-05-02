import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  User as UserIcon, Mail, Calendar, Globe, CreditCard, Activity,
  TrendingUp, FileText, Tag, X, Save, Plus, LogIn, UserPlus as SignupIcon,
  CheckCircle, Star, ShoppingCart, Loader2,
} from "lucide-react";

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  NEW: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DORMANT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  AT_RISK: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  CHURNED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  DEACTIVATED: "bg-muted text-muted-foreground border-border",
};

const EVENT_ICONS: Record<string, any> = {
  signup: SignupIcon,
  login: LogIn,
  verified: CheckCircle,
  founding: Star,
  subscription: CreditCard,
  trade: TrendingUp,
  email: Mail,
};

const EVENT_COLORS: Record<string, string> = {
  signup: "text-cyan-400",
  login: "text-emerald-400",
  verified: "text-emerald-500",
  founding: "text-amber-400",
  subscription: "text-blue-400",
  trade: "text-purple-400",
  email: "text-muted-foreground",
};

export function UserDetailDrawer({ userId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [notesDraft, setNotesDraft] = useState("");
  const [newTag, setNewTag] = useState("");

  const { data, isLoading } = useQuery<{ user: any; events: any[] }>({
    queryKey: ["/api/admin/users", userId, "timeline"],
    enabled: !!userId && open,
  });

  const user = data?.user;
  const events = data?.events || [];

  useEffect(() => {
    setNotesDraft(user?.adminNotes || "");
  }, [user?.userId]);

  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId!)}/notes`, { notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Notes saved" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save notes" }),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId!)}/tags`, { tags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "timeline"] });
      setNewTag("");
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update tags" }),
  });

  const addTag = () => {
    const cleaned = newTag.trim().toLowerCase().slice(0, 32);
    if (!cleaned || !user) return;
    const current: string[] = user.adminTags || [];
    if (current.includes(cleaned)) return;
    updateTagsMutation.mutate([...current, cleaned]);
  };

  const removeTag = (tag: string) => {
    if (!user) return;
    const current: string[] = user.adminTags || [];
    updateTagsMutation.mutate(current.filter(t => t !== tag));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto bg-card border-border" data-testid="drawer-user-detail">
        {isLoading || !user ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-sm font-black">
                  {(user.fullName || user.userId).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg font-black uppercase tracking-tight truncate" data-testid="text-drawer-user-name">
                    {user.fullName || user.userId}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-mono truncate">{user.userId}</SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge className={cn("text-[9px] font-black uppercase tracking-widest border", LIFECYCLE_COLORS[user.lifecycleStage] || LIFECYCLE_COLORS.ACTIVE)} data-testid="badge-drawer-lifecycle">
                  {user.lifecycleStage?.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-border">
                  {user.subscriptionTier || "FREE"}
                </Badge>
                {user.foundingMember && (
                  <Badge className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Star size={9} className="mr-1" fill="currentColor" /> Founder
                  </Badge>
                )}
                {user.emailVerified && (
                  <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest border-emerald-500/30 text-emerald-400">
                    <CheckCircle size={9} className="mr-1" /> Verified
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Notes & Tags</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatBox label="LTV (est.)" value={`$${user.ltvEstimate || 0}`} accent="emerald" testid="stat-ltv" />
                  <StatBox label="Trades" value={user.tradeCount ?? 0} accent="purple" testid="stat-trades" />
                  <StatBox label="Account Age" value={`${user.ageDays || 0}d`} accent="cyan" testid="stat-age" />
                  <StatBox label="Days Inactive" value={`${user.inactiveDays || 0}d`} accent={user.inactiveDays > 30 ? "rose" : "muted"} testid="stat-inactive" />
                </div>
                <Separator className="bg-border" />
                <div className="space-y-3">
                  <Field label="Country" icon={Globe} value={user.country || "—"} />
                  <Field label="Source" icon={Activity} value={user.utmSource ? `${user.utmSource}${user.utmCampaign ? ` / ${user.utmCampaign}` : ""}` : "Direct"} />
                  <Field label="Referred By" icon={UserIcon} value={user.referredBy || "—"} />
                  <Field label="Joined" icon={Calendar} value={user.createdAt ? `${format(new Date(user.createdAt), "MMM d, yyyy")} (${formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })})` : "—"} />
                  <Field label="Last Login" icon={LogIn} value={user.lastLoginAt ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true }) : "Never"} />
                  <Field label="Subscription" icon={CreditCard} value={`${user.subscriptionTier || "FREE"} • ${user.subscriptionStatus || "n/a"} • ${user.subscriptionProvider || "—"}`} />
                  {user.renewalDate && (
                    <Field label="Renewal" icon={Calendar} value={format(new Date(user.renewalDate), "MMM d, yyyy")} />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="pt-4">
                {events.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">No timeline events yet.</div>
                ) : (
                  <div className="space-y-3" data-testid="list-timeline">
                    {events.map((e, i) => {
                      const Icon = EVENT_ICONS[e.type] || Activity;
                      return (
                        <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0" data-testid={`event-${e.type}-${i}`}>
                          <div className={cn("h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center shrink-0", EVENT_COLORS[e.type] || "text-muted-foreground")}>
                            <Icon size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground">{e.label}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {format(new Date(e.at), "MMM d, yyyy • h:mm a")} · {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                            </div>
                            {e.meta?.netPl != null && (
                              <div className={cn("text-[10px] font-mono mt-0.5", parseFloat(e.meta.netPl) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                Net P/L: {parseFloat(e.meta.netPl) >= 0 ? "+" : ""}{e.meta.netPl}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-5 pt-4">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Tag size={11} /> Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]" data-testid="list-tags">
                    {(user.adminTags || []).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] font-bold border-blue-500/30 text-blue-400 gap-1.5 pr-1.5" data-testid={`tag-${tag}`}>
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-rose-400" data-testid={`button-remove-tag-${tag}`}>
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                    {(user.adminTags || []).length === 0 && (
                      <span className="text-[10px] text-muted-foreground/60 italic">No tags yet</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Add tag (e.g. 'high-value', 'beta-tester')"
                      className="h-8 text-xs bg-muted border-border"
                      data-testid="input-new-tag"
                      maxLength={32}
                    />
                    <Button size="sm" onClick={addTag} disabled={!newTag.trim() || updateTagsMutation.isPending} className="h-8 text-[10px] uppercase tracking-widest font-bold" data-testid="button-add-tag">
                      <Plus size={11} className="mr-1" /> Add
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border" />

                <div>
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileText size={11} /> Admin Notes
                  </label>
                  <Textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    placeholder="Internal notes about this user (not visible to user)…"
                    rows={8}
                    maxLength={5000}
                    className="text-xs bg-muted border-border font-mono"
                    data-testid="textarea-admin-notes"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">{notesDraft.length}/5000</span>
                    <Button size="sm"
                      onClick={() => saveNotesMutation.mutate(notesDraft)}
                      disabled={saveNotesMutation.isPending || notesDraft === (user.adminNotes || "")}
                      className="h-8 text-[10px] uppercase tracking-widest font-bold"
                      data-testid="button-save-notes"
                    >
                      {saveNotesMutation.isPending ? <Loader2 size={11} className="mr-1 animate-spin" /> : <Save size={11} className="mr-1" />}
                      Save Notes
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatBox({ label, value, accent, testid }: { label: string; value: any; accent: string; testid?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
    rose: "text-rose-400",
    muted: "text-foreground",
  };
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3" data-testid={testid}>
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-xl font-black", colors[accent] || colors.muted)}>{value}</div>
    </div>
  );
}

function Field({ label, icon: Icon, value }: { label: string; icon: any; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={13} className="text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="text-xs text-foreground truncate">{value}</div>
      </div>
    </div>
  );
}
