import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  Plus, 
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Strategies() {
  return (
    <div className="min-h-screen bg-background p-6 pb-24 md:pb-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic text-foreground">
              My Strategies
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Define your trading rules. Tradify checks whether you respect them.
            </p>
          </div>
          <Link href="/strategies/create">
            <Button 
              data-testid="button-create-strategy"
              className="gap-2"
            >
              <Plus size={18} />
              Create Strategy
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="border-dashed border-2 border-border bg-transparent flex flex-col items-center justify-center min-h-[200px] cursor-pointer group">
            <Link href="/strategies/create" className="w-full h-full flex flex-col items-center justify-center p-6">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <Plus size={32} className="text-emerald-500" />
              </div>
              <h3 className="font-bold text-foreground mb-1">Create Your First Strategy</h3>
              <p className="text-sm text-muted-foreground text-center">
                Define the rules you believe in
              </p>
            </Link>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-500">
              <Sparkles size={18} />
              Understanding Strategies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">1</div>
                  Define Your Rules
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  Create a strategy with your own trading rules. Market context, execution conditions, and risk parameters.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">2</div>
                  Trade Your Way
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  Execute trades through MT5 or log manually. Your trades are automatically synced and recorded.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">3</div>
                  Measure Discipline
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  Your Compliance Score shows how well you follow your own rules. Pattern insights reveal behavioral drift.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Tradify does not give trade signals</p>
                  <p className="text-xs text-muted-foreground">
                    You define how you trade. Tradify checks whether you respect that. The platform evaluates alignment, not entries.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
