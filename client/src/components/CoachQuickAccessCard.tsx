import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Users, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface Student {
  id: number;
  studentId: string;
  status: "invited" | "active";
}

export function CoachQuickAccessCard() {
  const { data: students } = useQuery<Student[]>({
    queryKey: ["/api/coach/students"],
    staleTime: 60_000,
  });

  const list = students || [];
  const active = list.filter((s) => s.status === "active").length;
  const pending = list.filter((s) => s.status === "invited").length;
  const slots = Math.max(0, 25 - list.length);

  return (
    <Card
      className="mb-6 border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-card"
      data-testid="card-coach-quick-access"
    >
      <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <GraduationCap className="text-violet-400" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-foreground" data-testid="text-coach-card-title">
                Your Coach Dashboard
              </h3>
              <Badge className="bg-violet-500/15 text-violet-400 border border-violet-500/30 text-[9px] font-black uppercase tracking-widest">
                Coach Tier
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5" data-testid="text-active-students">
                <Users size={12} className="text-emerald-500" />
                <span className="font-bold text-foreground">{active}</span> active
              </span>
              <span className="flex items-center gap-1.5" data-testid="text-pending-invites">
                <MessageSquare size={12} className="text-amber-500" />
                <span className="font-bold text-foreground">{pending}</span> pending
              </span>
              <span data-testid="text-coach-slots-left">
                <span className="font-bold text-foreground">{slots}</span> slots left
              </span>
            </div>
          </div>
        </div>
        <Link href="/coach">
          <a>
            <Button
              size="sm"
              className="bg-violet-500 hover:bg-violet-600 text-white"
              data-testid="button-open-coach-dashboard"
            >
              Open Coach Hub <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </a>
        </Link>
      </CardContent>
    </Card>
  );
}
