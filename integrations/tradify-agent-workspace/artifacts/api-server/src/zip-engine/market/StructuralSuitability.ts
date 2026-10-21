import type { Candle } from "./types";

export interface StructuralSuitabilityReport {
  canonicalSymbol: string;
  referenceProvider: string;
  comparisonProvider: string;
  comparedBars: number;
  alignedBars: number;
  missingReferenceBars: number;
  missingComparisonBars: number;
  directionAgreementPercent: number;
  returnCorrelation: number | null;
  structurallySuitable: boolean;
  reasons: string[];
}

function closeToOpenReturn(candle: Candle): number {
  return candle.open > 0 ? candle.close / candle.open - 1 : 0;
}

function correlation(left: number[], right: number[]): number | null {
  if (left.length < 2 || left.length !== right.length) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  const numerator = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftVariance = left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0);
  const rightVariance = right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0);
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? numerator / denominator : null;
}

export function compareStructuralSuitability(
  canonicalSymbol: string,
  referenceProvider: string,
  reference: Candle[],
  comparisonProvider: string,
  comparison: Candle[],
): StructuralSuitabilityReport {
  const referenceByTime = new Map(reference.map((candle) => [candle.time, candle]));
  const comparisonByTime = new Map(comparison.map((candle) => [candle.time, candle]));
  const allTimes = new Set([...referenceByTime.keys(), ...comparisonByTime.keys()]);
  const aligned = [...allTimes]
    .sort((left, right) => left - right)
    .flatMap((time) => {
      const left = referenceByTime.get(time);
      const right = comparisonByTime.get(time);
      return left && right ? [{ left, right }] : [];
    });
  const referenceReturns = aligned.map(({ left }) => closeToOpenReturn(left));
  const comparisonReturns = aligned.map(({ right }) => closeToOpenReturn(right));
  const directionalMatches = aligned.filter(
    ({ left, right }) => Math.sign(closeToOpenReturn(left)) === Math.sign(closeToOpenReturn(right)),
  ).length;
  const directionAgreementPercent = aligned.length
    ? Math.round((directionalMatches / aligned.length) * 10000) / 100
    : 0;
  const report: StructuralSuitabilityReport = {
    canonicalSymbol,
    referenceProvider,
    comparisonProvider,
    comparedBars: allTimes.size,
    alignedBars: aligned.length,
    missingReferenceBars: [...comparisonByTime.keys()].filter((time) => !referenceByTime.has(time))
      .length,
    missingComparisonBars: [...referenceByTime.keys()].filter((time) => !comparisonByTime.has(time))
      .length,
    directionAgreementPercent,
    returnCorrelation: correlation(referenceReturns, comparisonReturns),
    structurallySuitable: false,
    reasons: [],
  };
  if (report.alignedBars < 50)
    report.reasons.push("At least 50 aligned closed M15 bars are required.");
  const allowedEdgeGap = Math.max(2, Math.floor(report.comparedBars * 0.05));
  if (
    report.missingReferenceBars > allowedEdgeGap ||
    report.missingComparisonBars > allowedEdgeGap
  ) {
    report.reasons.push("The providers have a material mismatch in M15 timestamp coverage.");
  }
  if (report.directionAgreementPercent < 70) {
    report.reasons.push("M15 candle direction agreement is below 70%.");
  }
  if (report.returnCorrelation !== null && report.returnCorrelation < 0.6) {
    report.reasons.push("Normalized M15 return correlation is below 0.6.");
  }
  report.structurallySuitable = report.reasons.length === 0;
  return report;
}
