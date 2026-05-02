import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, MessageSquare, Check, X } from "lucide-react";

interface Invite {
  id: number;
  coach_id: string;
  coach_email: string;
  coach_username: string | null;
  invited_at: string;
}
interface ActiveCoach {
  id: number;
  coach_id: string;
  coach_email: string;
  coach_username: string | null;
  accepted_at: string;
}
interface Feedback {
  id: number;
  trade_id: number | null;
  content: string;
  created_at: string;
}
interface CoachData {
  invites: Invite[];
  activeCoach: ActiveCoach | null;
  recentFeedback: Feedback[];
}

export function MyCoachBanner() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CoachData>({
    queryKey: ["/api/student/coach"],
    staleTime: 60_000,
  });

  const respondMut = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "accept" | "decline" }) =>
      apiRequest("POST", `/api/student/coach-invite/${id}/respond`, { action }),
    onSuccess: (_d, vars) => {
      toast({ title: vars.action === "accept" ? "Coach accepted" : "Invite declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/student/coach"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (isLoading || !data) return null;
  if (!data.invites.length && !data.activeCoach) return null;

  return (
    <div className="space-y-3 mb-6" data-testid="my-coach-banner">
      {data.invites.map((inv) => (
        <Card key={inv.id} className="border-violet-500/40 bg-gradient-to-r from-violet-500/10 to-card">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <GraduationCap className="text-violet-500" size={22} />
              <div>
                <div className="font-bold text-sm">
                  Coach invite from <span className="text-violet-500">{inv.coach_username || inv.coach_email}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  They'll be able to read your trades and leave feedback. You can revoke any time.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => respondMut.mutate({ id: inv.id, action: "accept" })}
                disabled={respondMut.isPending}
                className="bg-violet-500 hover:bg-violet-600 text-white"
                data-testid={`button-accept-invite-${inv.id}`}
              >
                <Check size={14} className="mr-1" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => respondMut.mutate({ id: inv.id, action: "decline" })}
                disabled={respondMut.isPending}
                data-testid={`button-decline-invite-${inv.id}`}
              >
                <X size={14} className="mr-1" /> Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {data.activeCoach && (
        <Card className="border-violet-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-violet-500" size={18} />
                <span className="text-sm font-bold">
                  Your coach: <span className="text-violet-500">{data.activeCoach.coach_username || data.activeCoach.coach_email}</span>
                </span>
              </div>
              <Badge className="bg-violet-500/15 text-violet-500">Active</Badge>
            </div>
            {data.recentFeedback.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="coach-feedback-list">
                {data.recentFeedback.slice(0, 3).map((f) => (
                  <div key={f.id} className="border-l-2 border-violet-500/40 pl-3 py-1 text-sm">
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      <MessageSquare size={10} className="inline mr-1" />
                      {new Date(f.created_at).toLocaleDateString()}
                      {f.trade_id && ` · trade #${f.trade_id}`}
                    </div>
                    <div className="text-xs whitespace-pre-wrap line-clamp-3">{f.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No feedback yet — your coach will leave notes here.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
