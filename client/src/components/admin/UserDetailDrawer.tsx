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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  User as UserIcon, Mail, Calendar, Globe, CreditCard, Activity,
  TrendingUp, FileText, Tag, X, Save, Plus, LogIn, UserPlus as SignupIcon,
  CheckCircle, Star, Loader2, Heart, Crown, KeyRound, Send, XCircle, Zap,
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
  signup: SignupIcon, login: LogIn, verified: CheckCircle, founding: Star,
  subscription: CreditCard, trade: TrendingUp, email: Mail,
};

const EVENT_COLORS: Record<string, string> = {
  signup: "text-cyan-400", login: "text-emerald-400", verified: "text-emerald-500",
  founding: "text-amber-400", subscription: "text-blue-400", trade: "text-purple-400",
  email: "text-muted-foreground",
};

function healthColor(score: number) {
  if (score >= 75) return { ring: "text-emerald-400", bg: "bg-emerald-500/15", label: "Healthy" };
  if (score >= 50) return { ring: "text-amber-400", bg: "bg-amber-500/15", label: "OK" };
  if (score >= 25) return { ring: "text-orange-400", bg: "bg-orange-500/15", label: "At Risk" };
  return { ring: "text-rose-400", bg: "bg-rose-500/15", label: "Critical" };
}

export function UserDetailDrawer({ userId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [notesDraft, setNotesDraft] = useState("");
  const [newTag, setNewTag] = useState("");
  const [grantTier, setGrantTier] = useState("PRO");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const { data, isLoading } = useQuery<{ user: any; events: any[] }>({
    queryKey: ["/api/admin/users", userId, "timeline"],
    enabled: !!userId && open,
  });

  const { data: tagSuggestions = [] } = useQuery<Array<{ tag: string; count: number }>>({
    queryKey: ["/api/admin/tags/suggestions"],
    enabled: open,
  });

  const user = data?.user;
  const events = data?.events || [];
  const emailEvents = events.filter(e => e.type === "email");

  // Health score: mirror backend formula (server/routes.ts) exactly
  // verified +15, mt5 +20, paid&active +30, recent login +20 / +10, hasTrades +15
  const healthScore = (() => {
    if (!user) return 0;
    const isPaid = ["PRO", "ELITE", "COACH"].includes(user.subscriptionTier);
    const isCancelled = ["cancelled", "canceled"].includes(user.subscriptionStatus);
    const createdAtMs = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const lastLoginMs = user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : createdAtMs;
    const inactiveDays = Math.floor((Date.now() - lastLoginMs) / 86400000);
    let s = 0;
    if (user.emailVerified) s += 15;
    if (user.mt5Connected || events.some(e => e.type === "trade")) s += 20;
    if (isPaid && !isCancelled) s += 30;
    if (inactiveDays <= 7) s += 20;
    else if (inactiveDays <= 30) s += 10;
    if (events.some(e => e.type === "trade")) s += 15;
    return Math.min(100, s);
  })();

  useEffect(() => {
    setNotesDraft(user?.adminNotes || "");
    setEmailSubject("");
    setEmailBody("");
  }, [user?.userId]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "timeline"] });
  };

  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId!)}/notes`, { notes });
      return res.json();
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Notes saved" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to save notes" }),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${encodeURIComponent(userId!)}/tags`, { tags });
      return res.json();
    },
    onSuccess: () => { invalidateAll(); queryClient.invalidateQueries({ queryKey: ["/api/admin/tags/suggestions"] }); setNewTag(""); },
    onError: () => toast({ variant: "destructive", title: "Failed to update tags" }),
  });

  const grantTierMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${encodeURIComponent(userId!)}/grant-tier`, { tier });
      return res.json();
    },
    onSuccess: (_, tier) => { invalidateAll(); toast({ title: `Granted ${tier}` }); },
    onError: () => toast({ variant: "destructive", title: "Failed to grant tier" }),
  });

  const cancelSubMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/users/${encodeURIComponent(userId!)}/cancel-subscription`, {});
      return res.json();
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Subscription cancelled" }); },
    onError: () => toast({ variant: "destructive", title: "Cancel failed" }),
  });

  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/users/${encodeURIComponent(userId!)}/send-password-reset`, {});
      return res.json();
    },
    onSuccess: () => { invalidateAll(); toast({ title: "Password reset email sent" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to send reset" }),
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/users/${encodeURIComponent(userId!)}/send-email`, {
        subject: emailSubject, body: emailBody,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setEmailSubject(""); setEmailBody("");
      toast({ title: "Email sent" });
    },
    onError: () => toast({ variant: "destructive", title: "Email failed to send" }),
  });

  const addTag = (raw?: string) => {
    const cleaned = (raw ?? newTag).trim().toLowerCase().slice(0, 32);
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

  const userTagSet = new Set<string>(user?.adminTags || []);
  const filteredSuggestions = tagSuggestions
    .filter(s => !userTagSet.has(s.tag))
    .filter(s => !newTag.trim() || s.tag.includes(newTag.trim().toLowerCase()))
    .slice(0, 12);

  const hc = healthColor(healthScore);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-card border-border" data-testid="drawer-user-detail">
        {isLoading || !user ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-sm font-black shrink-0">
                  {(user.fullName || user.userId).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg font-black uppercase tracking-tight truncate" data-testid="text-drawer-user-name">
                    {user.fullName || user.userId}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-mono truncate">{user.userId}</SheetDescription>
                </div>
                {/* Health score circle */}
                <div className={cn("flex flex-col items-center justify-center rounded-lg border border-border px-3 py-2 shrink-0", hc.bg)} data-testid="badge-health-score">
                  <Heart size={11} className={hc.ring} fill="currentColor" />
                  <div className={cn("text-base font-black tabular-nums leading-none mt-0.5", hc.ring)}>{healthScore}</div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{hc.label}</div>
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
                <TabsTrigger value="comms" data-testid="tab-comms">Comms</TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
                <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
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

              <TabsContent value="comms" className="pt-4">
                <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Mail size={11} /> Emails sent ({emailEvents.length})
                </div>
                {emailEvents.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">No emails sent to this user yet.</div>
                ) : (
                  <div className="space-y-2" data-testid="list-comms">
                    {emailEvents.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-md bg-muted/30 border border-border" data-testid={`email-${i}`}>
                        <Mail size={13} className={cn("mt-0.5 shrink-0", e.meta?.success === false ? "text-rose-400" : "text-emerald-400")} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{e.label.replace(/^Email:\s*/, "")}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {e.meta?.template && <span className="font-mono mr-2">[{e.meta.template}]</span>}
                            {format(new Date(e.at), "MMM d, h:mm a")} · {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                          </div>
                        </div>
                        {e.meta?.success === false && (
                          <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest border-rose-500/30 text-rose-400 shrink-0">Failed</Badge>
                        )}
                      </div>
                    ))}
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
                    <Button size="sm" onClick={() => addTag()} disabled={!newTag.trim() || updateTagsMutation.isPending} className="h-8 text-[10px] uppercase tracking-widest font-bold" data-testid="button-add-tag">
                      <Plus size={11} className="mr-1" /> Add
                    </Button>
                  </div>
                  {filteredSuggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Suggestions</div>
                      <div className="flex flex-wrap gap-1.5" data-testid="list-tag-suggestions">
                        {filteredSuggestions.map(s => (
                          <button
                            key={s.tag}
                            onClick={() => addTag(s.tag)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 transition-colors"
                            data-testid={`button-suggest-tag-${s.tag}`}
                          >
                            {s.tag} <span className="opacity-50 ml-1">{s.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

              <TabsContent value="actions" className="space-y-5 pt-4">
                {/* Grant tier */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Crown size={11} /> Grant Plan Access
                  </label>
                  <div className="flex gap-2">
                    <Select value={grantTier} onValueChange={setGrantTier}>
                      <SelectTrigger className="h-9 text-xs bg-muted border-border" data-testid="select-grant-tier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE">Downgrade to Free</SelectItem>
                        <SelectItem value="PRO">PRO ($29/mo)</SelectItem>
                        <SelectItem value="ELITE">ELITE ($59/mo)</SelectItem>
                        <SelectItem value="COACH">COACH ($99/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => {
                        if (confirm(`Grant ${grantTier} access to ${user.fullName || user.userId}? This bypasses billing.`)) {
                          grantTierMutation.mutate(grantTier);
                        }
                      }}
                      disabled={grantTierMutation.isPending}
                      className="h-9 text-[10px] uppercase tracking-widest font-bold bg-amber-500 text-slate-950 hover:bg-amber-600"
                      data-testid="button-grant-tier"
                    >
                      {grantTierMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Crown size={11} className="mr-1" />}
                      Grant
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Bypasses payment. Use for partnerships, founding members, refunds, or testing.</p>
                </div>

                <Separator className="bg-border" />

                {/* Account actions */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Zap size={11} /> Account Actions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm("Send a password reset email to this user? Their current password will continue to work until they use the link.")) {
                          passwordResetMutation.mutate();
                        }
                      }}
                      disabled={passwordResetMutation.isPending}
                      className="h-9 text-[10px] uppercase tracking-widest font-bold justify-start"
                      data-testid="button-send-reset"
                    >
                      {passwordResetMutation.isPending ? <Loader2 size={11} className="mr-1 animate-spin" /> : <KeyRound size={11} className="mr-1.5" />}
                      Send Password Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Cancel ${user.subscriptionTier} subscription for this user? Access continues until renewal date.`)) {
                          cancelSubMutation.mutate();
                        }
                      }}
                      disabled={cancelSubMutation.isPending || !["PRO", "ELITE", "COACH"].includes(user.subscriptionTier) || ["cancelled", "canceled"].includes(user.subscriptionStatus)}
                      className="h-9 text-[10px] uppercase tracking-widest font-bold justify-start text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      data-testid="button-cancel-sub"
                    >
                      {cancelSubMutation.isPending ? <Loader2 size={11} className="mr-1 animate-spin" /> : <XCircle size={11} className="mr-1.5" />}
                      Cancel Subscription
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border" />

                {/* Email composer */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Send size={11} /> Send Custom Email
                  </label>
                  <Input
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    placeholder="Subject line"
                    maxLength={200}
                    className="h-9 text-xs bg-muted border-border"
                    data-testid="input-email-subject"
                  />
                  <Textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    placeholder="Write your message… Plain text supported, line breaks preserved."
                    rows={7}
                    maxLength={20000}
                    className="text-xs bg-muted border-border"
                    data-testid="textarea-email-body"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">{emailBody.length}/20000 · sent from Tradify support</span>
                    <Button
                      onClick={() => sendEmailMutation.mutate()}
                      disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
                      className="h-8 text-[10px] uppercase tracking-widest font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600"
                      data-testid="button-send-email"
                    >
                      {sendEmailMutation.isPending ? <Loader2 size={11} className="mr-1 animate-spin" /> : <Send size={11} className="mr-1" />}
                      Send Email
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
    emerald: "text-emerald-400", purple: "text-purple-400", cyan: "text-cyan-400",
    rose: "text-rose-400", muted: "text-foreground",
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
