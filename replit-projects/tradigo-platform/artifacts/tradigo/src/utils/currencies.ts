// Centralized canonical currency metadata
export interface CurrencyMetadata {
  code: string;
  minorUnitDivisor: number;
}

const currencyRegistry: Record<string, CurrencyMetadata> = {
  USD: { code: 'USD', minorUnitDivisor: 100 },
  EUR: { code: 'EUR', minorUnitDivisor: 100 },
  GBP: { code: 'GBP', minorUnitDivisor: 100 },
  JOD: { code: 'JOD', minorUnitDivisor: 1000 },
  BHD: { code: 'BHD', minorUnitDivisor: 1000 },
  KWD: { code: 'KWD', minorUnitDivisor: 1000 },
  OMR: { code: 'OMR', minorUnitDivisor: 1000 },
  TND: { code: 'TND', minorUnitDivisor: 1000 },
  JPY: { code: 'JPY', minorUnitDivisor: 1 },
  KRW: { code: 'KRW', minorUnitDivisor: 1 },
};

export const getCurrencyMetadata = (currencyCode: string): CurrencyMetadata | undefined => {
  return currencyRegistry[currencyCode.toUpperCase()];
};
