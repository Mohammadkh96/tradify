import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { usePlan } from "@/hooks/usePlan";
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
  ShieldCheck,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: strategies = [], isLoading } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
  });

  const { isPaid: isPro, maxStrategies, isLoading: isPlanLoading } = usePlan();
  const isUserLoaded = !isPlanLoading;
  const isAtLimit = isUserLoaded && maxStrategies !== -1 && strategies.length >= maxStrategies;

  const activateMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      await apiRequest("POST", `/api/strategies/${strategyId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: t("strategies.toastActivated") });
    },
    onError: (error: Error) => {
      toast({ title: t("strategies.toastError"), description: error.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      const response = await apiRequest("POST", `/api/strategies/${strategyId}/duplicate`);
      if (!response.ok) {
        const data = await response.json();
        if (data.error === "PLAN_LIMIT_REACHED" || data.error === "FREE_LIMIT_REACHED") {
          throw new Error("LIMIT_REACHED");
        }
        throw new Error(data.message || "Failed to duplicate strategy");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: t("strategies.toastDuplicated") });
    },
    onError: (error: Error) => {
      if (error.message === "LIMIT_REACHED") {
        toast({ 
          title: t("strategies.toastLimitReached"), 
          description: t("strategies.toastLimitDesc"), 
          variant: "destructive" 
        });
      } else {
        toast({ title: t("strategies.toastError"), description: error.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (strategyId: number) => {
      await apiRequest("DELETE", `/api/strategies/${strategyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: t("strategies.toastDeleted") });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: t("strategies.toastError"), description: error.message, variant: "destructive" });
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
              {t("strategies.myStrategies")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("strategies.subtitle")}
            </p>
            {isUserLoaded && !isPro && maxStrategies !== -1 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("strategies.usageCount", { used: strategies.length, max: maxStrategies })}
              </p>
            )}
          </div>
          {isAtLimit ? (
            <Link to="/pricing">
              <Button data-testid="button-upgrade-pro" className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 border-amber-600">
                <Crown size={18} />
                {t("strategies.upgradeForUnlimited")}
              </Button>
            </Link>
          ) : (
            <Link to="/strategies/create">
              <Button data-testid="button-create-strategy" className="gap-2">
                <Plus size={18} />
                {t("strategies.createStrategy")}
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
                    <span className="font-semibold text-foreground">{t("strategies.strategyLimitReached")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("strategies.freeLimitMessage", { max: maxStrategies })}
                  </p>
                </div>
                <Link to="/pricing">
                  <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 border-amber-600">
                    <Crown size={14} className="mr-1" />
                    {t("strategies.upgrade")}
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
                      {t("strategies.active")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("strategies.usedForCompliance")}
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
              <Link to="/strategies/create" className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <Plus size={32} className="text-emerald-500" />
                </div>
                <h3 className="font-bold text-foreground mb-1">{t("strategies.createFirst")}</h3>
                <p className="text-sm text-muted-foreground text-center">
                  {t("strategies.defineRules")}
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
                            {t("strategies.setAsActive")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => navigate(`/strategies/${strategy.id}/edit`)}
                          data-testid={`menu-edit-${strategy.id}`}
                        >
                          <Pencil size={14} className="mr-2" />
                          {t("strategies.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(strategy.id)}
                          disabled={duplicateMutation.isPending}
                          data-testid={`menu-duplicate-${strategy.id}`}
                        >
                          <Copy size={14} className="mr-2" />
                          {t("strategies.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(strategy.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`menu-delete-${strategy.id}`}
                        >
                          <Trash2 size={14} className="mr-2" />
                          {t("strategies.delete")}
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
                          {t("strategies.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Circle size={12} className="mr-1" />
                          {t("strategies.inactive")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ListChecks size={14} />
                      <span>{t("strategies.rulesCount", { count: strategy.rules?.length || 0 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed border-2 border-border bg-transparent flex flex-col items-center justify-center min-h-[160px] cursor-pointer group">
              <Link to="/strategies/create" className="w-full h-full flex flex-col items-center justify-center p-6">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3 group-hover:bg-muted/80 transition-colors">
                  <Plus size={24} className="text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">{t("strategies.addStrategy")}</span>
              </Link>
            </Card>
          </div>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-500">
              <Sparkles size={18} />
              {t("strategies.howCompliance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">1</div>
                  {t("strategies.step1Title")}
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  {t("strategies.step1Desc")}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">2</div>
                  {t("strategies.step2Title")}
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  {t("strategies.step2Desc")}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">3</div>
                  {t("strategies.step3Title")}
                </div>
                <p className="text-sm text-muted-foreground pl-8">
                  {t("strategies.step3Desc")}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 rounded bg-violet-500/20 flex items-center justify-center">
                      <CheckCircle2 size={12} className="text-violet-500" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-violet-500">{t("strategies.subjectiveRules")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("strategies.subjectiveDesc")}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-5 w-5 rounded bg-cyan-500/20 flex items-center justify-center">
                      <Target size={12} className="text-cyan-500" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide text-cyan-500">{t("strategies.objectiveRules")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("strategies.objectiveDesc")}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <AlertCircle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{t("strategies.noSignalsTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("strategies.noSignalsDesc")}
                  </p>
                </div>
              </div>

              <Link to="/strategies/validate">
                <Button variant="outline" className="w-full gap-2" data-testid="button-open-validator">
                  <ShieldCheck size={16} />
                  {t("strategies.openValidator")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("strategies.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("strategies.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("strategies.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : null}
              {t("strategies.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
