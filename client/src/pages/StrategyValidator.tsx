import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  Target,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import {
  RuleCategory,
  RULE_TYPE_CATALOG,
  type RuleCategoryType,
  type RuleTypeKey,
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

interface RuleInputState {
  [ruleId: number]: {
    value: any;
    passed: boolean | null;
  };
}

const CATEGORY_LABELS: Record<RuleCategoryType, { label: string; color: string }> = {
  [RuleCategory.SUBJECTIVE]: { label: "Subjective", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  [RuleCategory.RISK_EXECUTION]: { label: "Risk & Execution", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  [RuleCategory.CONTEXT]: { label: "Context", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
};

export default function StrategyValidator() {
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [ruleInputs, setRuleInputs] = useState<RuleInputState>({});
  const [hasValidated, setHasValidated] = useState(false);

  const { data: strategies, isLoading } = useQuery<Strategy[]>({
    queryKey: ["/api/strategies"],
  });

  const activeStrategy = useMemo(() => {
    return strategies?.find((s) => s.isActive);
  }, [strategies]);

  const selectedStrategy = useMemo(() => {
    if (selectedStrategyId) {
      return strategies?.find((s) => s.id === selectedStrategyId);
    }
    return activeStrategy;
  }, [strategies, selectedStrategyId, activeStrategy]);

  useEffect(() => {
    if (selectedStrategy && selectedStrategy.rules) {
      const initialInputs: RuleInputState = {};
      selectedStrategy.rules.forEach((rule) => {
        const ruleDefinition = RULE_TYPE_CATALOG[rule.ruleType as RuleTypeKey];
        let defaultValue: any = null;

        if (ruleDefinition) {
          switch (ruleDefinition.inputType) {
            case "boolean":
              defaultValue = false;
              break;
            case "number":
              defaultValue = "";
              break;
            case "select":
              defaultValue = "";
              break;
            case "multiselect":
              defaultValue = [];
              break;
            case "time_range":
              defaultValue = "";
              break;
          }
        }

        initialInputs[rule.id] = {
          value: defaultValue,
          passed: null,
        };
      });
      setRuleInputs(initialInputs);
      setHasValidated(false);
    }
  }, [selectedStrategy]);

  const updateRuleInput = (ruleId: number, value: any) => {
    setRuleInputs((prev) => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId],
        value,
        passed: null,
      },
    }));
    setHasValidated(false);
  };

  const validateRules = () => {
    if (!selectedStrategy) return;

    const newInputs = { ...ruleInputs };
    let allPassed = true;

    selectedStrategy.rules.forEach((rule) => {
      const input = ruleInputs[rule.id];
      const ruleDefinition = RULE_TYPE_CATALOG[rule.ruleType as RuleTypeKey];
      const strategyValue = rule.options?.value;

      if (!input || !ruleDefinition) {
        newInputs[rule.id] = { ...input, passed: false };
        allPassed = false;
        return;
      }

      let passed = false;

      switch (ruleDefinition.inputType) {
        case "boolean":
          passed = input.value === true;
          break;

        case "number":
          const inputNum = parseFloat(input.value);
          const requiredNum = parseFloat(strategyValue);
          if (!isNaN(inputNum) && !isNaN(requiredNum)) {
            const comparator = ruleDefinition.numberComparator || 'eq';
            switch (comparator) {
              case 'gte':
                passed = inputNum >= requiredNum;
                break;
              case 'lte':
                passed = inputNum <= requiredNum;
                break;
              case 'eq':
              default:
                passed = inputNum === requiredNum;
                break;
            }
          }
          break;

        case "select":
          passed = input.value === strategyValue;
          break;

        case "multiselect":
          const expectedValues = Array.isArray(strategyValue) ? strategyValue : [];
          passed = expectedValues.length === 0 || expectedValues.includes(input.value);
          break;

        case "time_range":
          passed = input.value !== "";
          break;
      }

      newInputs[rule.id] = { ...input, passed };
      if (!passed) allPassed = false;
    });

    setRuleInputs(newInputs);
    setHasValidated(true);
  };

  const unalignedRules = useMemo(() => {
    if (!hasValidated || !selectedStrategy) return [];
    return selectedStrategy.rules.filter((rule) => ruleInputs[rule.id]?.passed === false);
  }, [hasValidated, selectedStrategy, ruleInputs]);

  const passedRules = useMemo(() => {
    if (!hasValidated || !selectedStrategy) return [];
    return selectedStrategy.rules.filter((rule) => ruleInputs[rule.id]?.passed === true);
  }, [hasValidated, selectedStrategy, ruleInputs]);

  const isAligned = hasValidated && unalignedRules.length === 0;

  const renderRuleInput = (rule: StrategyRule) => {
    const ruleDefinition = RULE_TYPE_CATALOG[rule.ruleType as RuleTypeKey];
    const input = ruleInputs[rule.id];

    if (!ruleDefinition || !input) return null;

    const strategyValue = rule.options?.value;

    switch (ruleDefinition.inputType) {
      case "boolean":
        return (
          <div className="flex items-center gap-3">
            <Switch
              checked={input.value === true}
              onCheckedChange={(checked) => updateRuleInput(rule.id, checked)}
              data-testid={`switch-${rule.ruleType}`}
            />
            <span className="text-sm text-muted-foreground">
              {input.value ? "Yes" : "No"}
            </span>
          </div>
        );

      case "number":
        const validation = ruleDefinition.validation;
        const prefix = ruleDefinition.displayPrefix || '';
        const suffix = ruleDefinition.displaySuffix || '';
        const placeholder = ruleDefinition.inputPlaceholder || `Value`;
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={input.value}
              onChange={(e) => updateRuleInput(rule.id, e.target.value)}
              placeholder={placeholder}
              min={validation?.min}
              max={validation?.max}
              step={validation?.step}
              className="w-32"
              data-testid={`input-${rule.ruleType}`}
            />
            <span className="text-xs text-muted-foreground">
              {prefix} {strategyValue}{suffix}
            </span>
          </div>
        );

      case "select":
        return (
          <Select
            value={input.value}
            onValueChange={(val) => updateRuleInput(rule.id, val)}
          >
            <SelectTrigger className="w-48" data-testid={`select-${rule.ruleType}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {ruleDefinition.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        const multiselectPlaceholder = ruleDefinition.inputPlaceholder || 'Select...';
        return (
          <Select
            value={input.value}
            onValueChange={(val) => updateRuleInput(rule.id, val)}
          >
            <SelectTrigger className="w-48" data-testid={`multiselect-${rule.ruleType}`}>
              <SelectValue placeholder={multiselectPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {ruleDefinition.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "time_range":
        return (
          <Input
            type="time"
            value={input.value}
            onChange={(e) => updateRuleInput(rule.id, e.target.value)}
            className="w-32"
            data-testid={`time-${rule.ruleType}`}
          />
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!strategies || strategies.length === 0) {
    return (
      <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
        <main className="p-6 lg:p-10 max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Strategy Validator</h1>
            <p className="text-muted-foreground mt-1">Check trade alignment with your rules</p>
          </header>
          <Card className="p-8 text-center">
            <Target className="mx-auto mb-4 text-muted-foreground" size={48} />
            <h2 className="text-xl font-semibold mb-2">No Strategies Found</h2>
            <p className="text-muted-foreground mb-4">
              Create a strategy first to validate your trades against your rules.
            </p>
            <Link href="/strategies/create">
              <Button>
                Create Strategy
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 text-foreground pb-20 md:pb-0 bg-background">
      <main className="p-6 lg:p-10 max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Strategy Validator</h1>
          <p className="text-muted-foreground mt-1">Check trade alignment with your rules</p>
        </header>

        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Select Strategy
              </label>
              <Select
                value={selectedStrategyId?.toString() || activeStrategy?.id?.toString() || ""}
                onValueChange={(val) => setSelectedStrategyId(parseInt(val))}
              >
                <SelectTrigger className="w-72" data-testid="select-strategy">
                  <SelectValue placeholder="Choose a strategy..." />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id.toString()}>
                      <div className="flex items-center gap-2">
                        {strategy.name}
                        {strategy.isActive && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 text-[10px] py-0">
                            Active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedStrategy && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedStrategy.rules?.length || 0}</span> rules to validate
              </div>
            )}
          </div>
        </Card>

        {selectedStrategy && selectedStrategy.rules?.length > 0 ? (
          <>
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target size={18} className="text-emerald-500" />
                Rule Checklist
              </h2>

              <div className="space-y-4">
                {selectedStrategy.rules.map((rule) => {
                  const categoryInfo = CATEGORY_LABELS[rule.category as RuleCategoryType] || {
                    label: rule.category,
                    color: "bg-muted text-muted-foreground",
                  };
                  const input = ruleInputs[rule.id];
                  const isPassed = input?.passed;

                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        hasValidated && isPassed === true && "border-emerald-500/30 bg-emerald-500/5",
                        hasValidated && isPassed === false && "border-rose-500/30 bg-rose-500/5",
                        !hasValidated && "border-border"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {hasValidated && isPassed === true && (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            )}
                            {hasValidated && isPassed === false && (
                              <XCircle size={16} className="text-rose-500" />
                            )}
                            {!hasValidated && (
                              <ChevronRight size={16} className="text-muted-foreground" />
                            )}
                            <span className="font-medium">{rule.label}</span>
                            <Badge variant="outline" className={cn("text-[10px] py-0", categoryInfo.color)}>
                              {categoryInfo.label}
                            </Badge>
                          </div>
                          {rule.description && (
                            <p className="text-xs text-muted-foreground ml-6">{rule.description}</p>
                          )}
                        </div>

                        <div className="ml-6 sm:ml-0">
                          {renderRuleInput(rule)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={validateRules}
                  size="lg"
                  data-testid="button-validate"
                >
                  <ShieldCheck size={18} className="mr-2" />
                  Validate Trade
                </Button>
              </div>
            </Card>

            {hasValidated && (
              <Card
                className={cn(
                  "p-6",
                  isAligned
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-rose-500/30 bg-rose-500/5"
                )}
                data-testid="validation-result"
              >
                <div className="flex items-center gap-4">
                  {isAligned ? (
                    <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <ShieldCheck size={32} className="text-emerald-500" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-rose-500/20 flex items-center justify-center">
                      <ShieldAlert size={32} className="text-rose-500" />
                    </div>
                  )}

                  <div className="flex-1">
                    <h2 className={cn(
                      "text-2xl font-bold",
                      isAligned ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {isAligned ? "Strategy Aligned" : "Strategy Not Aligned"}
                    </h2>
                    
                    {isAligned ? (
                      <p className="text-muted-foreground">
                        All {passedRules.length} rules passed. This trade aligns with your strategy.
                      </p>
                    ) : (
                      <div className="mt-2">
                        <p className="text-muted-foreground mb-2">
                          {unalignedRules.length} of {selectedStrategy.rules.length} rules not aligned:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {unalignedRules.map((rule: StrategyRule) => (
                            <Badge
                              key={rule.id}
                              variant="outline"
                              className="bg-rose-500/10 text-rose-500 border-rose-500/30"
                            >
                              <AlertTriangle size={12} className="mr-1" />
                              {rule.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </>
        ) : selectedStrategy && selectedStrategy.rules?.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 text-amber-500" size={48} />
            <h2 className="text-xl font-semibold mb-2">No Rules Defined</h2>
            <p className="text-muted-foreground mb-4">
              This strategy has no rules to validate against.
            </p>
            <Link href="/strategies/create">
              <Button variant="outline">
                Create New Strategy with Rules
              </Button>
            </Link>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
