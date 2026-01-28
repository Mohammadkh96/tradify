import { RULE_TYPE_CATALOG, type RuleTypeKey } from "../shared/ruleTypes";
import type { Trade, StrategyRule, TradeRuleEvaluation } from "@shared/schema";

export interface RuleEvaluationResult {
  ruleId: number;
  ruleType: string;
  ruleLabel: string;
  expectedValue: unknown;
  actualValue: unknown;
  passed: boolean;
  violationReason: string | null;
}

export interface ComplianceEvaluationResult {
  overallCompliant: boolean;
  ruleEvaluations: RuleEvaluationResult[];
  violations: RuleEvaluationResult[];
}

export interface TradeInputs {
  entryConfirmationPresent?: boolean;
  setupPresent?: boolean;
  personalModelConfirmed?: boolean;
  stopLossSet?: boolean;
  takeProfitSet?: boolean;
  riskPercent?: number;
  riskReward?: number;
  tradesToday?: number;
  currentSession?: string;
  tradeTime?: string;
  directionalBiasPresent?: boolean;
}

function parseRuleValue(options: unknown): unknown {
  if (options === null || options === undefined) return null;
  if (typeof options === "object" && options !== null && "value" in options) {
    return (options as { value: unknown }).value;
  }
  return options;
}

function evaluateNumberRule(
  actualValue: number | undefined,
  expectedValue: number,
  comparator: "gte" | "lte" | "eq"
): boolean {
  if (actualValue === undefined || actualValue === null) return false;
  switch (comparator) {
    case "gte":
      return actualValue >= expectedValue;
    case "lte":
      return actualValue <= expectedValue;
    case "eq":
      return actualValue === expectedValue;
    default:
      return false;
  }
}

function evaluateBooleanRule(
  actualValue: boolean | undefined,
  expectedValue: boolean
): boolean {
  if (actualValue === undefined) return false;
  return actualValue === expectedValue;
}

function evaluateMultiselectRule(
  actualValue: string | undefined,
  expectedValues: string[]
): boolean {
  if (!actualValue || expectedValues.length === 0) return true;
  return expectedValues.includes(actualValue);
}

function evaluateTimeRangeRule(
  tradeTime: string | undefined,
  timeRange: { start: string; end: string } | string
): boolean {
  if (!tradeTime) return true;
  if (typeof timeRange === "string" && timeRange === "") return true;
  
  let start: string, end: string;
  if (typeof timeRange === "object" && timeRange !== null) {
    start = timeRange.start;
    end = timeRange.end;
  } else if (typeof timeRange === "string" && timeRange.includes("-")) {
    [start, end] = timeRange.split("-");
  } else {
    return true;
  }
  
  const tradeMinutes = parseTimeToMinutes(tradeTime);
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  
  if (tradeMinutes === null || startMinutes === null || endMinutes === null) {
    return true;
  }
  
  return tradeMinutes >= startMinutes && tradeMinutes <= endMinutes;
}

function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

export function evaluateTradeCompliance(
  trade: Trade,
  rules: StrategyRule[],
  tradeInputs: TradeInputs
): ComplianceEvaluationResult {
  const ruleEvaluations: RuleEvaluationResult[] = [];
  
  for (const rule of rules) {
    const ruleDefinition = RULE_TYPE_CATALOG[rule.ruleType as RuleTypeKey];
    if (!ruleDefinition) continue;
    
    const expectedValue = parseRuleValue(rule.options);
    let actualValue: unknown;
    let passed = false;
    let violationReason: string | null = null;
    
    switch (rule.ruleType) {
      case "ENTRY_CONFIRMATION_REQUIRED":
        actualValue = tradeInputs.entryConfirmationPresent ?? trade.entryConfirmed;
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Entry confirmation not present";
        break;
        
      case "SETUP_PRESENT":
        actualValue = tradeInputs.setupPresent;
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Setup not identified";
        break;
        
      case "PERSONAL_MODEL_CONFIRMED":
        actualValue = tradeInputs.personalModelConfirmed;
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Personal model criteria not met";
        break;
        
      case "SL_REQUIRED":
        actualValue = tradeInputs.stopLossSet ?? (trade.stopLoss !== null && trade.stopLoss !== "");
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Stop loss not set";
        break;
        
      case "TP_REQUIRED":
        actualValue = tradeInputs.takeProfitSet ?? (trade.takeProfit !== null && trade.takeProfit !== "");
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Take profit not set";
        break;
        
      case "MAX_RISK_PERCENT":
        actualValue = tradeInputs.riskPercent;
        const maxRisk = typeof expectedValue === "number" ? expectedValue : parseFloat(String(expectedValue));
        passed = evaluateNumberRule(actualValue as number, maxRisk, "lte");
        if (!passed) violationReason = `Risk ${actualValue}% exceeds maximum ${maxRisk}%`;
        break;
        
      case "MIN_RISK_REWARD":
        actualValue = tradeInputs.riskReward ?? parseFloat(trade.riskReward || "0");
        const minRR = typeof expectedValue === "number" ? expectedValue : parseFloat(String(expectedValue));
        passed = evaluateNumberRule(actualValue as number, minRR, "gte");
        if (!passed) violationReason = `R:R ${actualValue} below minimum ${minRR}`;
        break;
        
      case "MAX_TRADES_PER_DAY":
        actualValue = tradeInputs.tradesToday ?? 1;
        const maxTrades = typeof expectedValue === "number" ? expectedValue : parseInt(String(expectedValue));
        passed = evaluateNumberRule(actualValue as number, maxTrades, "lte");
        if (!passed) violationReason = `${actualValue} trades today exceeds limit of ${maxTrades}`;
        break;
        
      case "SESSION_ALLOWED":
        actualValue = tradeInputs.currentSession;
        const allowedSessions = Array.isArray(expectedValue) ? expectedValue : [];
        passed = evaluateMultiselectRule(actualValue as string, allowedSessions as string[]);
        if (!passed) violationReason = `Session "${actualValue}" not in allowed sessions`;
        break;
        
      case "TIME_WINDOW_ALLOWED":
        actualValue = tradeInputs.tradeTime;
        passed = evaluateTimeRangeRule(actualValue as string, expectedValue as { start: string; end: string });
        if (!passed) violationReason = `Trade time outside allowed window`;
        break;
        
      case "DIRECTIONAL_BIAS_REQUIRED":
        actualValue = tradeInputs.directionalBiasPresent ?? trade.htfBiasClear;
        passed = evaluateBooleanRule(actualValue as boolean, expectedValue as boolean);
        if (!passed) violationReason = "Directional bias not established";
        break;
        
      default:
        passed = true;
    }
    
    ruleEvaluations.push({
      ruleId: rule.id,
      ruleType: rule.ruleType,
      ruleLabel: rule.label,
      expectedValue,
      actualValue,
      passed,
      violationReason: passed ? null : violationReason,
    });
  }
  
  const violations = ruleEvaluations.filter((r) => !r.passed);
  const overallCompliant = violations.length === 0;
  
  return {
    overallCompliant,
    ruleEvaluations,
    violations,
  };
}
