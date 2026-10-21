import { getCurrencyMetadata } from './currencies';

export const formatMoney = (amountMinor: string | number | bigint, currency: string = 'USD'): string => {
  const metadata = getCurrencyMetadata(currency);
  if (!metadata) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  // Safe numerical conversion avoiding standard float/number pitfalls for massive values
  // Since this is for UI presentation, we can convert strings to numbers assuming they are within JS limits,
  // or handle BigInt down to major values.
  let majorValue: number;
  if (typeof amountMinor === 'bigint') {
    majorValue = Number(amountMinor) / metadata.minorUnitDivisor;
  } else if (typeof amountMinor === 'string') {
    // If it's a very large string, we can use BigInt to prevent parsing precision loss before division
    majorValue = Number(BigInt(amountMinor)) / metadata.minorUnitDivisor;
  } else {
    majorValue = amountMinor / metadata.minorUnitDivisor;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: metadata.code,
  }).format(majorValue);
};

export const formatDate = (dateString: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(dateString));
};

export const formatDateTime = (dateString: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString));
};
