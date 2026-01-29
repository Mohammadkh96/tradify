import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  MoreVertical,
  CheckCircle2,
  Circle,
  Zap,
  Copy,
  Pencil,
  Trash2,
  Loader2,
  ListChecks,
  Sparkles,
  AlertCircle,
  Crown,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FREE_STRATEGY_LIMIT = 1;

interface Strategy {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rules?: any[];
}

export default function Strategies() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: strategies = [], isLoading } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
  });

  const isUserLoaded = user !== undefined;
  const subscription = user?.subscriptionTier?.toUpperCase() || "FREE";
  const isPro = subscription === "PRO" || subscription === "ELITE";
  const isAtLimit = isUserLoaded && !isPro && strategies.length >= FREE_STRATEGY_LIMIT;

  const activateMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      await apiRequest("POST", `/api/strategies/${strategyId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy activated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      const response = await apiRequest("POST", `/api/strategies/${strategyId}/duplicate`);
      if (!response.ok) {
        const data = await response.json();
        if (data.error === "FREE_LIMIT_REACHED") {
          throw new Error("LIMIT_REACHED");
        }
        throw new Error(data.message || "Failed to duplicate strategy");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy duplicated" });
    },
    onError: (error: Error) => {
      if (error.message === "LIMIT_REACHED") {
        toast({ 
          title: "Strategy Limit Reached", 
          description: "Upgrade to Pro for unlimited strategies.", 
          variant: "destructive" 
        });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      await apiRequest("DELETE", `/api/strategies/${strategyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy deleted" });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  const handleSetActive = (strategyId: number) => {
    activateMutation.mutate(strategyId);
  };

  const handleDuplicate = (strategyId: number) => {
    duplicateMutation.mutate(strategyId);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  const activeStrategy = strategies.find(s => s.isActive);

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
            {isUserLoaded && !isPro && (
              <p className="text-xs text-muted-foreground mt-1">
                {strategies.length}/{FREE_STRATEGY_LIMIT} strategies used (Free plan)
              </p>
            )}
          </div>
          {isAtLimit ? (
            <Link href="/pricing">
              <Button data-testid="button-upgrade-pro" className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 border-amber-600">
                <Crown size={18} />
                Upgrade for Unlimited
              </Button>
            </Link>
          ) : (
            <Link href="/strategies/create">
              <Button data-testid="button-create-strategy" className="gap-2">
                <Plus size={18} />
                Create Strategy
              </Button>
            </Link>
          )}
        </div>

        {isAtLimit && (
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Lock size={20} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Strategy Limit Reached</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Free accounts are limited to {FREE_STRATEGY_LIMIT} strategy. Upgrade to Pro for unlimited strategies.
                  </p>
                </div>
                <Link href="/pricing">
                  <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 border-amber-600">
                    <Crown size={14} className="mr-1" />
                    Upgrade
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStrategy && (
          <Card className="bg-emerald-500/5 border-emerald-500/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Zap size={20} className="text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{activeStrategy.name}</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This strategy is used for compliance tracking
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : strategies.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {strategies.map((strategy) => (
              <Card
                key={strategy.id}
                className={cn(
                  "relative transition-all",
                  strategy.isActive && "ring-2 ring-emerald-500/50"
                )}
                data-testid={`card-strategy-${strategy.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-bold truncate">
                        {strategy.name}
                      </CardTitle>
                      {strategy.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {strategy.description}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-menu-${strategy.id}`}
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!strategy.isActive && (
                          <DropdownMenuItem
                            onClick={() => handleSetActive(strategy.id)}
                            disabled={activateMutation.isPending}
                            data-testid={`menu-activate-${strategy.id}`}
                          >
                            <Zap size={14} className="mr-2" />
                            Set as Active
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setLocation(`/strategies/${strategy.id}/edit`)}
                          data-testid={`menu-edit-${strategy.id}`}
                        >
                          <Pencil size={14} className="mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(strategy.id)}
                          disabled={duplicateMutation.isPending}
                          data-testid={`menu-duplicate-${strategy.id}`}
                        >
                          <Copy size={14} className="mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(strategy.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-delete-${strategy.id}`}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {strategy.isActive ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          <CheckCircle2 size={12} className="mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Circle size={12} className="mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ListChecks size={14} />
                      <span>{strategy.rules?.length || 0} rules</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed border-2 border-border bg-transparent flex flex-col items-center justify-center min-h-[160px] cursor-pointer group">
              <Link href="/strategies/create" className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                  <Plus size={24} className="text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Add Strategy</span>
              </Link>
            </Card>
          </div>
        )}

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

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this strategy? This action cannot be undone.
              Your trade history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
