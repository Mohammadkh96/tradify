import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  ChevronRight,
  Check,
  Plus,
  X,
  Loader2,
  FileText,
  ListChecks,
  Settings,
  Tag,
  Eye,
  Zap,
} from "lucide-react";
import {
  RuleCategory,
  RuleType,
  RULE_TYPE_CATALOG,
  getRulesByCategory,
  type RuleTypeKey,
  type RuleTypeDefinition,
  type RuleCategoryType,
} from "@shared/ruleTypes";

interface SelectedRule {
  ruleType: RuleTypeKey;
  definition: RuleTypeDefinition;
  customLabel: string;
  value: string | number | boolean | string[];
}

const STEPS = [
  { id: 1, label: "Basics", icon: FileText },
  { id: 2, label: "Rules", icon: ListChecks },
  { id: 3, label: "Configure", icon: Settings },
  { id: 4, label: "Labels", icon: Tag },
  { id: 5, label: "Review", icon: Eye },
];

const CATEGORY_LABELS: Record<RuleCategoryType, { label: string; color: string }> = {
  [RuleCategory.SUBJECTIVE]: { label: "Subjective", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  [RuleCategory.RISK_EXECUTION]: { label: "Risk & Execution", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  [RuleCategory.CONTEXT]: { label: "Context", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
};

export default function CreateStrategy() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");
  const [selectedRules, setSelectedRules] = useState<SelectedRule[]>([]);
  const [isActive, setIsActive] = useState(true);

  const createStrategyMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      isActive: boolean;
      rules: SelectedRule[];
    }) => {
      const response = await apiRequest("POST", "/api/strategies", data);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === "FREE_LIMIT_REACHED") {
          throw new Error("LIMIT_REACHED");
        }
        throw new Error(errorData.message || "Failed to create strategy");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({
        title: "Strategy Created",
        description: `"${strategyName}" has been saved successfully.`,
      });
      navigate("/strategies");
    },
    onError: (error: Error) => {
      if (error.message === "LIMIT_REACHED") {
        toast({
          title: "Strategy Limit Reached",
          description: "Free accounts are limited to 1 strategy. Upgrade to Pro for unlimited strategies.",
          variant: "destructive",
        });
        navigate("/pricing");
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create strategy",
          variant: "destructive",
        });
      }
    },
  });

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return strategyName.trim().length > 0;
      case 2:
        return selectedRules.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddRule = (ruleType: RuleTypeKey) => {
    const definition = RULE_TYPE_CATALOG[ruleType];
    if (!definition) return;

    const alreadySelected = selectedRules.some((r) => r.ruleType === ruleType);
    if (alreadySelected) {
      setSelectedRules(selectedRules.filter((r) => r.ruleType !== ruleType));
    } else {
      const defaultValue = definition.defaultValue ?? (definition.inputType === "boolean" ? true : "");
      setSelectedRules([
        ...selectedRules,
        {
          ruleType,
          definition,
          customLabel: definition.label,
          value: defaultValue as string | number | boolean | string[],
        },
      ]);
    }
  };

  const handleRemoveRule = (ruleType: RuleTypeKey) => {
    setSelectedRules(selectedRules.filter((r) => r.ruleType !== ruleType));
  };

  const handleUpdateRuleValue = (ruleType: RuleTypeKey, value: string | number | boolean | string[]) => {
    setSelectedRules(
      selectedRules.map((r) => (r.ruleType === ruleType ? { ...r, value } : r))
    );
  };

  const handleUpdateRuleLabel = (ruleType: RuleTypeKey, customLabel: string) => {
    setSelectedRules(
      selectedRules.map((r) => (r.ruleType === ruleType ? { ...r, customLabel } : r))
    );
  };

  const handleSubmit = () => {
    createStrategyMutation.mutate({
      name: strategyName,
      description: strategyDescription,
      isActive,
      rules: selectedRules,
    });
  };

  const renderRuleInput = (rule: SelectedRule) => {
    const { definition, value } = rule;

    switch (definition.inputType) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked) => handleUpdateRuleValue(rule.ruleType, checked)}
              data-testid={`switch-${rule.ruleType}`}
            />
            <span className="text-sm text-muted-foreground">
              {value ? "Required" : "Not Required"}
            </span>
          </div>
        );

      case "number":
        return (
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleUpdateRuleValue(rule.ruleType, parseFloat(e.target.value) || 0)}
              min={definition.validation?.min}
              max={definition.validation?.max}
              step={definition.validation?.step}
              className="w-24"
              data-testid={`input-${rule.ruleType}`}
            />
            {rule.ruleType === RuleType.MAX_RISK_PERCENT && (
              <span className="text-sm text-muted-foreground">%</span>
            )}
            {rule.ruleType === RuleType.MIN_RISK_REWARD && (
              <span className="text-sm text-muted-foreground">: 1 R:R</span>
            )}
            {rule.ruleType === RuleType.MAX_TRADES_PER_DAY && (
              <span className="text-sm text-muted-foreground">trades</span>
            )}
          </div>
        );

      case "multiselect":
        return (
          <div className="flex flex-wrap gap-2">
            {definition.options?.map((option) => {
              const selected = (value as string[])?.includes(option.value);
              return (
                <Badge
                  key={option.value}
                  variant={selected ? "default" : "outline"}
                  className={cn("cursor-pointer transition-all", selected && "bg-primary")}
                  onClick={() => {
                    const currentValues = (value as string[]) || [];
                    if (selected) {
                      handleUpdateRuleValue(
                        rule.ruleType,
                        currentValues.filter((v) => v !== option.value)
                      );
                    } else {
                      handleUpdateRuleValue(rule.ruleType, [...currentValues, option.value]);
                    }
                  }}
                  data-testid={`badge-${rule.ruleType}-${option.value}`}
                >
                  {option.label}
                </Badge>
              );
            })}
          </div>
        );

      case "time_range":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={(value as string)?.split("-")[0] || "09:00"}
              onChange={(e) => {
                const end = (value as string)?.split("-")[1] || "17:00";
                handleUpdateRuleValue(rule.ruleType, `${e.target.value}-${end}`);
              }}
              className="w-28"
              data-testid={`input-${rule.ruleType}-start`}
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="time"
              value={(value as string)?.split("-")[1] || "17:00"}
              onChange={(e) => {
                const start = (value as string)?.split("-")[0] || "09:00";
                handleUpdateRuleValue(rule.ruleType, `${start}-${e.target.value}`);
              }}
              className="w-28"
              data-testid={`input-${rule.ruleType}-end`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Create Strategy</h1>
          <p className="text-muted-foreground mt-1">Define your trading framework</p>
        </header>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                    currentStep === step.id
                      ? "bg-primary border-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                  data-testid={`step-indicator-${step.id}`}
                >
                  {currentStep > step.id ? (
                    <Check size={18} />
                  ) : (
                    <step.icon size={18} />
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-12 lg:w-24 h-0.5 mx-2",
                      currentStep > step.id ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step) => (
              <span
                key={step.id}
                className={cn(
                  "text-xs font-medium",
                  currentStep === step.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>

        <Card className="p-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Strategy Details</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Give your strategy a name and description to identify it later.
                </p>
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
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Select Rules</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose the rules that define your trading strategy. Click to add or remove.
                </p>
              </div>

              {Object.values(RuleCategory).map((category) => {
                const categoryInfo = CATEGORY_LABELS[category];
                const rules = getRulesByCategory(category);

                return (
                  <div key={category} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      {categoryInfo.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rules.map((rule) => {
                        const isSelected = selectedRules.some((r) => r.ruleType === rule.key);
                        return (
                          <div
                            key={rule.key}
                            onClick={() => handleAddRule(rule.key)}
                            className={cn(
                              "p-4 rounded-lg border cursor-pointer transition-all",
                              isSelected
                                ? "bg-primary/10 border-primary"
                                : "bg-card border-border hover-elevate"
                            )}
                            data-testid={`rule-${rule.key}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm truncate">
                                    {rule.label}
                                  </span>
                                  <Badge variant="outline" className={cn("text-xs shrink-0", categoryInfo.color)}>
                                    {rule.inputType}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {rule.description}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                                  isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border"
                                )}
                              >
                                {isSelected && <Check size={14} />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {selectedRules.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ListChecks size={16} />
                    <span>{selectedRules.length} rule{selectedRules.length !== 1 ? "s" : ""} selected</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Configure Rules</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Set the parameters for each rule in your strategy.
                </p>
              </div>

              {selectedRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListChecks className="mx-auto mb-3 opacity-50" size={40} />
                  <p>No rules selected. Go back and add some rules.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedRules.map((rule) => (
                    <div
                      key={rule.ruleType}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <h4 className="font-medium">{rule.definition.label}</h4>
                          <p className="text-xs text-muted-foreground">
                            {rule.definition.description}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRule(rule.ruleType)}
                          data-testid={`button-remove-${rule.ruleType}`}
                        >
                          <X size={16} />
                        </Button>
                      </div>
                      {renderRuleInput(rule)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Custom Labels</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Personalize rule labels to match your trading terminology.
                </p>
              </div>

              {selectedRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="mx-auto mb-3 opacity-50" size={40} />
                  <p>No rules selected. Go back and add some rules.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedRules.map((rule) => (
                    <div key={rule.ruleType} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          value={rule.customLabel}
                          onChange={(e) => handleUpdateRuleLabel(rule.ruleType, e.target.value)}
                          placeholder={rule.definition.label}
                          data-testid={`input-label-${rule.ruleType}`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {rule.definition.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Review Strategy</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Review your strategy before saving.
                </p>
              </div>

              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h3 className="text-sm font-semibold mb-2">Strategy Name</h3>
                  <p className="text-lg font-bold">{strategyName}</p>
                  {strategyDescription && (
                    <p className="text-sm text-muted-foreground mt-2">{strategyDescription}</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">Rules ({selectedRules.length})</h3>
                  <div className="space-y-2">
                    {selectedRules.map((rule) => {
                      const categoryInfo = CATEGORY_LABELS[rule.definition.category];
                      return (
                        <div
                          key={rule.ruleType}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn("text-xs", categoryInfo.color)}>
                              {categoryInfo.label}
                            </Badge>
                            <span className="font-medium">{rule.customLabel}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {typeof rule.value === "boolean"
                              ? rule.value
                                ? "Required"
                                : "Optional"
                              : Array.isArray(rule.value)
                              ? rule.value.join(", ")
                              : String(rule.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <h4 className="font-medium">Set as Active Strategy</h4>
                    <p className="text-xs text-muted-foreground">
                      Active strategy is used for trade compliance tracking
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    data-testid="switch-is-active"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 1}
              data-testid="button-back"
            >
              <ChevronLeft size={16} className="mr-2" />
              Back
            </Button>

            {currentStep < 5 ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                data-testid="button-next"
              >
                Next
                <ChevronRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createStrategyMutation.isPending}
                data-testid="button-save"
              >
                {createStrategyMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Zap size={16} className="mr-2" />
                )}
                Save Strategy
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
