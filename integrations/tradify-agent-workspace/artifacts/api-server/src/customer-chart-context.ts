// Only customer-approved numeric chart context crosses this boundary.
// Provider details, pivot provenance, and raw engine facts remain private.
export function customerChartContext(signal: Record<string, unknown>) {
  const trusted = signal.dataState === "LIVE";
  const price = (value: unknown) =>
    trusted && typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  return {
    sourceHigh: price(signal.sourceHigh),
    sourceLow: price(signal.sourceLow),
    pivotResistance: price(signal.pivotResistance),
    pivotSupport: price(signal.pivotSupport),
  };
}
