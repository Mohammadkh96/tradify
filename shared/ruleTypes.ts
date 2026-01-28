export const RuleCategory = {
  SUBJECTIVE: 'subjective',
  RISK_EXECUTION: 'risk_execution',
  CONTEXT: 'context',
} as const;

export type RuleCategoryType = typeof RuleCategory[keyof typeof RuleCategory];

export const RuleType = {
  ENTRY_CONFIRMATION_REQUIRED: 'ENTRY_CONFIRMATION_REQUIRED',
  SETUP_PRESENT: 'SETUP_PRESENT',
  PERSONAL_MODEL_CONFIRMED: 'PERSONAL_MODEL_CONFIRMED',
  SL_REQUIRED: 'SL_REQUIRED',
  TP_REQUIRED: 'TP_REQUIRED',
  MAX_RISK_PERCENT: 'MAX_RISK_PERCENT',
  MIN_RISK_REWARD: 'MIN_RISK_REWARD',
  MAX_TRADES_PER_DAY: 'MAX_TRADES_PER_DAY',
  SESSION_ALLOWED: 'SESSION_ALLOWED',
  TIME_WINDOW_ALLOWED: 'TIME_WINDOW_ALLOWED',
  DIRECTIONAL_BIAS_REQUIRED: 'DIRECTIONAL_BIAS_REQUIRED',
} as const;

export type RuleTypeKey = typeof RuleType[keyof typeof RuleType];

export type NumberComparator = 'gte' | 'lte' | 'eq';

export interface RuleTypeDefinition {
  key: RuleTypeKey;
  label: string;
  description: string;
  category: RuleCategoryType;
  inputType: 'boolean' | 'number' | 'select' | 'multiselect' | 'time_range';
  defaultValue?: string | number | boolean;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    step?: number;
  };
  numberComparator?: NumberComparator;
  displayPrefix?: string;
  displaySuffix?: string;
  inputPlaceholder?: string;
}

export const RULE_TYPE_CATALOG: Record<RuleTypeKey, RuleTypeDefinition> = {
  [RuleType.ENTRY_CONFIRMATION_REQUIRED]: {
    key: RuleType.ENTRY_CONFIRMATION_REQUIRED,
    label: 'Entry Confirmation Required',
    description: 'Require specific entry confirmation before taking a trade',
    category: RuleCategory.SUBJECTIVE,
    inputType: 'boolean',
    defaultValue: true,
  },
  [RuleType.SETUP_PRESENT]: {
    key: RuleType.SETUP_PRESENT,
    label: 'Setup Present',
    description: 'A valid setup must be identified before entry',
    category: RuleCategory.SUBJECTIVE,
    inputType: 'boolean',
    defaultValue: true,
  },
  [RuleType.PERSONAL_MODEL_CONFIRMED]: {
    key: RuleType.PERSONAL_MODEL_CONFIRMED,
    label: 'Personal Model Confirmed',
    description: 'Your personal trading model criteria must be met',
    category: RuleCategory.SUBJECTIVE,
    inputType: 'boolean',
    defaultValue: true,
  },
  [RuleType.SL_REQUIRED]: {
    key: RuleType.SL_REQUIRED,
    label: 'Stop Loss Required',
    description: 'Every trade must have a stop loss defined',
    category: RuleCategory.RISK_EXECUTION,
    inputType: 'boolean',
    defaultValue: true,
  },
  [RuleType.TP_REQUIRED]: {
    key: RuleType.TP_REQUIRED,
    label: 'Take Profit Required',
    description: 'Every trade must have a take profit defined',
    category: RuleCategory.RISK_EXECUTION,
    inputType: 'boolean',
    defaultValue: true,
  },
  [RuleType.MAX_RISK_PERCENT]: {
    key: RuleType.MAX_RISK_PERCENT,
    label: 'Maximum Risk Per Trade',
    description: 'Maximum percentage of account to risk per trade',
    category: RuleCategory.RISK_EXECUTION,
    inputType: 'number',
    defaultValue: 1,
    validation: {
      min: 0.1,
      max: 10,
      step: 0.1,
    },
    numberComparator: 'lte',
    displayPrefix: 'Max:',
    displaySuffix: '%',
    inputPlaceholder: 'Risk %',
  },
  [RuleType.MIN_RISK_REWARD]: {
    key: RuleType.MIN_RISK_REWARD,
    label: 'Minimum Risk/Reward Ratio',
    description: 'Minimum risk-to-reward ratio required for trade entry',
    category: RuleCategory.RISK_EXECUTION,
    inputType: 'number',
    defaultValue: 2,
    validation: {
      min: 0.5,
      max: 10,
      step: 0.5,
    },
    numberComparator: 'gte',
    displayPrefix: 'Min:',
    displaySuffix: ':1',
    inputPlaceholder: 'R:R ratio',
  },
  [RuleType.MAX_TRADES_PER_DAY]: {
    key: RuleType.MAX_TRADES_PER_DAY,
    label: 'Maximum Trades Per Day',
    description: 'Limit the number of trades you can take in a single day',
    category: RuleCategory.RISK_EXECUTION,
    inputType: 'number',
    defaultValue: 3,
    validation: {
      min: 1,
      max: 20,
      step: 1,
    },
    numberComparator: 'lte',
    displayPrefix: 'Max:',
    inputPlaceholder: 'Trades',
  },
  [RuleType.SESSION_ALLOWED]: {
    key: RuleType.SESSION_ALLOWED,
    label: 'Trading Sessions Allowed',
    description: 'Restrict trading to specific market sessions',
    category: RuleCategory.CONTEXT,
    inputType: 'multiselect',
    options: [
      { value: 'asian', label: 'Asian Session' },
      { value: 'london', label: 'London Session' },
      { value: 'new_york', label: 'New York Session' },
      { value: 'overlap', label: 'London/NY Overlap' },
    ],
    inputPlaceholder: 'Select option...',
  },
  [RuleType.TIME_WINDOW_ALLOWED]: {
    key: RuleType.TIME_WINDOW_ALLOWED,
    label: 'Trading Time Window',
    description: 'Only trade during specific hours of the day',
    category: RuleCategory.CONTEXT,
    inputType: 'time_range',
  },
  [RuleType.DIRECTIONAL_BIAS_REQUIRED]: {
    key: RuleType.DIRECTIONAL_BIAS_REQUIRED,
    label: 'Directional Bias Required',
    description: 'Require a clear directional bias before trading',
    category: RuleCategory.CONTEXT,
    inputType: 'boolean',
    defaultValue: true,
  },
};

export const getRulesByCategory = (category: RuleCategoryType): RuleTypeDefinition[] => {
  return Object.values(RULE_TYPE_CATALOG).filter(rule => rule.category === category);
};

export const getAllRuleTypes = (): RuleTypeDefinition[] => {
  return Object.values(RULE_TYPE_CATALOG);
};

export const getRuleTypeDefinition = (ruleType: RuleTypeKey): RuleTypeDefinition | undefined => {
  return RULE_TYPE_CATALOG[ruleType];
};
