import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  Save,
  Loader2,
  ListChecks,
  Zap,
} from "lucide-react";
import {
  RuleCategory,
  RULE_TYPE_CATALOG,
  type RuleCategoryType,
} from "@shared/ruleTypes";

interface StrategyRule {
  id: number;
  strategyId: number;
  category: string;
  label: string;
  description: string | null;
  ruleType: string;
  options: any;
  defaultValue: string | null;
  isRequired: boolean;
  sortOrder: number;
}

interface Strategy {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rules: StrategyRule[];
}

const CATEGORY_LABELS: Record<RuleCategoryType, { label: string; color: string }> = {
  [RuleCategory.SUBJECTIVE]: { label: "Subjective", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  [RuleCategory.RISK_EXECUTION]: { label: "Risk & Execution", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  [RuleCategory.CONTEXT]: { label: "Context", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
};

export default function EditStrategy() {
  const navigate = useNavigate();
  const params = useParams();
  const strategyId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");

  const { data: strategy, isLoading } = useQuery<Strategy>({
    queryKey: ["/api/strategies", strategyId],
    enabled: !!strategyId,
  });

  useEffect(() => {
    if (strategy) {
      setStrategyName(strategy.name);
      setStrategyDescription(strategy.description || "");
    }
  }, [strategy]);

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await apiRequest("PATCH", `/api/strategies/${strategyId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/strategies", strategyId] });
      toast({
        title: "Strategy Updated",
        description: `"${strategyName}" has been saved.`,
      });
      navigate("/strategies");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update strategy",
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/strategies/${strategyId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/strategies", strategyId] });
      toast({ title: "Strategy activated" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strategyName.trim()) {
      toast({
        title: "Error",
        description: "Strategy name is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({
      name: strategyName.trim(),
      description: strategyDescription.trim(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Strategy not found</p>
        <Button variant="outline" onClick={() => navigate("/strategies")}>
          Back to Strategies
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/strategies")}
            className="mb-4"
            data-testid="button-back"
          >
            <ChevronLeft size={16} className="mr-2" />
            Back to Strategies
          </Button>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Edit Strategy</h1>
          <p className="text-muted-foreground mt-1">Modify your trading framework</p>
        </header>

        <form onSubmit={handleSubmit}>
          <Card className="p-6 mb-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Strategy Details</h2>
                {strategy.isActive ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    <Zap size={12} className="mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => activateMutation.mutate()}
                    disabled={activateMutation.isPending}
                    data-testid="button-activate"
                  >
                    {activateMutation.isPending ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <Zap size={14} className="mr-2" />
                    )}
                    Set as Active
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Strategy Name</label>
                  <Input
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="e.g., London Session Breakout"
                    className="max-w-md"
                    data-testid="input-strategy-name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Textarea
                    value={strategyDescription}
                    onChange={(e) => setStrategyDescription(e.target.value)}
                    placeholder="Describe your strategy approach..."
                    className="max-w-md resize-none"
                    rows={4}
                    data-testid="input-strategy-description"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={18} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold">Rules ({strategy.rules?.length || 0})</h2>
            </div>

            {strategy.rules?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rules defined for this strategy.</p>
            ) : (
              <div className="space-y-3">
                {strategy.rules?.map((rule) => {
                  const categoryInfo = CATEGORY_LABELS[rule.category as RuleCategoryType] || {
                    label: rule.category,
                    color: "bg-muted text-muted-foreground",
                  };
                  const ruleDefinition = RULE_TYPE_CATALOG[rule.ruleType as keyof typeof RULE_TYPE_CATALOG];
                  
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn("text-xs", categoryInfo.color)}>
                          {categoryInfo.label}
                        </Badge>
                        <div>
                          <span className="font-medium">{rule.label}</span>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground">{rule.description}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {rule.options?.value !== undefined
                          ? typeof rule.options.value === "boolean"
                            ? rule.options.value
                              ? "Required"
                              : "Optional"
                            : Array.isArray(rule.options.value)
                            ? rule.options.value.join(", ")
                            : String(rule.options.value)
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-4">
              To modify rules, create a new strategy or duplicate this one.
            </p>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/strategies")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
