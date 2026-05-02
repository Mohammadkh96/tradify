import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePlan } from "@/hooks/usePlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, UserPlus, Mail, Trash2, MessageSquare, Lock, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";

interface Student {
  id: number;
  studentId: string;
  studentEmail: string;
  studentUsername: string | null;
  studentTier: string;
  status: "invited" | "active";
  invitedAt: string;
  acceptedAt: string | null;
}

interface Trade {
  id: number;
  pair: string;
  direction: string;
  outcome: string | null;
  profit_loss: string | null;
  entry_price: string | null;
  notes: string | null;
  created_at: string;
}

interface Feedback {
  id: number;
  trade_id: number | null;
  content: string;
  created_at: string;
}

export default function CoachDashboard() {
  const { isCoach, isLoading: planLoading, maxStudents } = usePlan();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [openStudent, setOpenStudent] = useState<Student | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [tradeFilter, setTradeFilter] = useState<number | null>(null);

  const studentsQ = useQuery<Student[]>({
    queryKey: ["/api/coach/students"],
    enabled: isCoach,
  });

  const tradesQ = useQuery<Trade[]>({
    queryKey: ["/api/coach/students", openStudent?.studentId, "trades"],
    queryFn: async () => {
      const r = await fetch(`/api/coach/students/${openStudent!.studentId}/trades`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!openStudent && openStudent.status === "active",
  });

  const feedbackQ = useQuery<Feedback[]>({
    queryKey: ["/api/coach/students", openStudent?.studentId, "feedback"],
    queryFn: async () => {
      const r = await fetch(`/api/coach/students/${openStudent!.studentId}/feedback`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    enabled: !!openStudent && openStudent.status === "active",
  });

  const inviteMut = useMutation({
    mutationFn: async (email: string) => apiRequest("POST", "/api/coach/invite", { email }),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `${inviteEmail} will see the invite next time they log in.` });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/coach/students"] });
    },
    onError: (e: any) => toast({ title: "Invite failed", description: e?.message || "Try again", variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: async (studentId: string) => apiRequest("DELETE", `/api/coach/students/${studentId}`),
    onSuccess: () => {
      toast({ title: "Student removed" });
      setOpenStudent(null);
      queryClient.invalidateQueries({ queryKey: ["/api/coach/students"] });
    },
  });

  const fbMut = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/coach/feedback", {
      studentId: openStudent!.studentId,
      tradeId: tradeFilter,
      content: feedbackText.trim(),
    }),
    onSuccess: () => {
      setFeedbackText("");
      setTradeFilter(null);
      toast({ title: "Feedback sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/students", openStudent?.studentId, "feedback"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (planLoading) {
    return <div className="flex-1 p-10"><div className="h-6 w-48 bg-muted rounded animate-pulse" /></div>;
  }

  if (!isCoach) {
    return (
      <div className="flex-1 p-10 max-w-3xl mx-auto">
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-card">
          <CardContent className="p-10 text-center">
            <Lock size={48} className="mx-auto text-violet-500 mb-4" />
            <h1 className="text-3xl font-black mb-2">Coach Tier Required</h1>
            <p className="text-muted-foreground mb-6">
              Upgrade to Coach ($99/mo) to mentor up to 25 students, view their trade journals,
              and leave per-trade feedback.
            </p>
            <Link href="/pricing">
              <a>
                <Button className="bg-violet-500 hover:bg-violet-600 text-white" data-testid="button-upgrade-to-coach">
                  <GraduationCap className="mr-2 h-4 w-4" /> See Coach Plan
                </Button>
              </a>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const students = studentsQ.data || [];
  const active = students.filter((s) => s.status === "active");
  const invited = students.filter((s) => s.status === "invited");

  return (
    <div className="flex-1 pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-2" data-testid="text-coach-title">
              <GraduationCap className="text-violet-500" /> Coach Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {active.length} active · {invited.length} pending · {maxStudents - students.length} slots left
            </p>
          </div>
        </header>

        <Card className="mb-8 border-violet-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus size={18} /> Invite a student
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2 flex-wrap"
              onSubmit={(e) => {
                e.preventDefault();
                if (inviteEmail.trim()) inviteMut.mutate(inviteEmail.trim());
              }}
            >
              <Input
                type="email"
                placeholder="student@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 min-w-[240px]"
                data-testid="input-invite-email"
              />
              <Button type="submit" disabled={inviteMut.isPending || !inviteEmail.trim()} data-testid="button-send-invite">
                {inviteMut.isPending ? "Sending…" : "Send invite"}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-2">
              Student must already have a TradifyApp account. They'll see your invite as a banner on their dashboard.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3 border-dashed">
              <CardContent className="p-10 text-center text-muted-foreground">
                No students yet. Invite your first one above.
              </CardContent>
            </Card>
          )}
          {students.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover-elevate active-elevate-2 border-border"
              onClick={() => s.status === "active" && setOpenStudent(s)}
              data-testid={`card-student-${s.studentId}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate" data-testid={`text-student-name-${s.studentId}`}>
                      {s.studentUsername || s.studentEmail}
                    </div>
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail size={11} /> {s.studentEmail}
                    </div>
                  </div>
                  <Badge
                    variant={s.status === "active" ? "default" : "outline"}
                    className={s.status === "invited" ? "border-amber-500/40 text-amber-500" : "bg-emerald-500/15 text-emerald-500"}
                    data-testid={`badge-student-status-${s.studentId}`}
                  >
                    {s.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
                  <span>Tier: {s.studentTier || "FREE"}</span>
                  {s.status === "active" && <ArrowUpRight size={14} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Student detail drawer */}
      <Sheet open={!!openStudent} onOpenChange={(o) => !o && setOpenStudent(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {openStudent && (
            <>
              <SheetHeader>
                <SheetTitle data-testid="text-drawer-student-name">
                  {openStudent.studentUsername || openStudent.studentEmail}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <Tabs defaultValue="trades">
                  <TabsList>
                    <TabsTrigger value="trades">Trades</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    <TabsTrigger value="manage">Manage</TabsTrigger>
                  </TabsList>

                  <TabsContent value="trades" className="space-y-2 mt-4">
                    {tradesQ.isLoading && <div className="text-sm text-muted-foreground">Loading trades…</div>}
                    {(tradesQ.data || []).length === 0 && !tradesQ.isLoading && (
                      <div className="text-sm text-muted-foreground">No trades logged yet.</div>
                    )}
                    {(tradesQ.data || []).map((t) => (
                      <div
                        key={t.id}
                        className="border border-border rounded-md p-3 text-sm hover-elevate cursor-pointer"
                        onClick={() => setTradeFilter(t.id)}
                        data-testid={`row-trade-${t.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{t.pair} · {t.direction}</span>
                          <span className={Number(t.profit_loss) >= 0 ? "text-emerald-500 font-mono" : "text-rose-500 font-mono"}>
                            {t.profit_loss ? `$${Number(t.profit_loss).toFixed(2)}` : "—"}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {t.outcome || "open"} · {new Date(t.created_at).toLocaleDateString()}
                        </div>
                        {t.notes && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.notes}</div>}
                        {tradeFilter === t.id && (
                          <Badge className="mt-2 bg-violet-500/15 text-violet-500">Selected for feedback</Badge>
                        )}
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="feedback" className="space-y-3 mt-4">
                    <div className="border border-border rounded-md p-3 bg-card">
                      <div className="text-xs text-muted-foreground mb-2">
                        {tradeFilter ? `Feedback on trade #${tradeFilter}` : "General feedback (no trade selected)"}
                        {tradeFilter && (
                          <button onClick={() => setTradeFilter(null)} className="ml-2 underline" data-testid="button-clear-trade-filter">
                            clear
                          </button>
                        )}
                      </div>
                      <Textarea
                        placeholder="Your feedback to the student…"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        rows={4}
                        maxLength={4000}
                        data-testid="input-feedback"
                      />
                      <div className="flex justify-end mt-2">
                        <Button
                          onClick={() => fbMut.mutate()}
                          disabled={!feedbackText.trim() || fbMut.isPending}
                          className="bg-violet-500 hover:bg-violet-600 text-white"
                          data-testid="button-send-feedback"
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          {fbMut.isPending ? "Sending…" : "Send feedback"}
                        </Button>
                      </div>
                    </div>

                    {(feedbackQ.data || []).map((f) => (
                      <div key={f.id} className="border border-border rounded-md p-3 text-sm" data-testid={`row-feedback-${f.id}`}>
                        <div className="text-[11px] text-muted-foreground mb-1">
                          {new Date(f.created_at).toLocaleString()} {f.trade_id && <span>· trade #{f.trade_id}</span>}
                        </div>
                        <div className="whitespace-pre-wrap">{f.content}</div>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="manage" className="mt-4">
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <div className="text-sm">
                          <strong>Status:</strong> {openStudent.status}<br />
                          <strong>Email:</strong> {openStudent.studentEmail}<br />
                          {openStudent.acceptedAt && (
                            <><strong>Accepted:</strong> {new Date(openStudent.acceptedAt).toLocaleDateString()}<br /></>
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Remove this student? They will lose your feedback access.")) {
                              removeMut.mutate(openStudent.studentId);
                            }
                          }}
                          data-testid="button-remove-student"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove student
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
