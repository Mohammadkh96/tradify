import { runInNewContext } from "node:vm";
import { tradingViewChartHtml } from "../components/trading-view-chart";
import { trustedM15Response } from "./fixtures/trusted-mt5-m15";
import { brandPalette, chartContextPalette } from "@/constants/colors";

type PriceLine = { title: string; price: number; color: string; axisLabelVisible: boolean };

// Execute the shipped embedded renderer's actual overlay functions. Only the
// canvas price-line API is replaced; direction/layer/trust logic is not mocked.
function overlayRenderer() {
  const html = tradingViewChartHtml;
  const start = html.indexOf("function clearPriceLines()");
  const end = html.indexOf("function updateCountdown()", start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const lines: PriceLine[] = [];
  const context = {
    mainSeries: {
      createPriceLine: (line: PriceLine) => { lines.push(line); return line; },
      removePriceLine: (line: PriceLine) => { lines.splice(lines.indexOf(line), 1); },
    },
    priceLines: [],
    lastLevelSignature: "",
    legendNode: { textContent: "" },
    theme: { primary: brandPalette.gold, context: chartContextPalette },
    safeNumber: (value: unknown) => typeof value === "number" && Number.isFinite(value),
  };
  const update = runInNewContext(`${html.slice(start, end)}; updateLevels`, context) as
    (data: Record<string, unknown>) => void;
  return { update, lines };
}

function payload(direction: "LONG" | "SHORT") {
  return {
    ...trustedM15Response,
    lastPrice: 106.1,
    visibleLayers: { entries: true, targets: true, stops: true, sources: true, pivots: true },
    levels: {
      direction,
      entry: direction === "LONG" ? 106.3 : 105.1,
      buyEntry: 106.3,
      sellEntry: 105.1,
      buyStop: 104.8,
      sellStop: 107.1,
      buyTargets: [107.2, 108.1, 109.4],
      sellTargets: [104.2, 103.4, 102.3],
      sourceHigh: 105.8,
      sourceLow: 100.2,
      pivotResistance: 106,
      pivotSupport: 100.6,
    },
  };
}

describe("shipped chart directional overlays", () => {
  it.each(["LONG", "SHORT"] as const)("renders only the matching %s plan", (direction) => {
    const renderer = overlayRenderer();
    const data = payload(direction);
    renderer.update(data);
    const long = direction === "LONG";
    expect(renderer.lines.map(({ title, price }) => ({ title, price }))).toEqual([
      { title: "SPOT", price: 106.1 },
      { title: "ENTRY", price: data.levels.entry },
      { title: long ? "BUY ENTRY" : "SELL ENTRY", price: long ? 106.3 : 105.1 },
      { title: "STOP", price: long ? 104.8 : 107.1 },
      ...(long ? data.levels.buyTargets : data.levels.sellTargets).map((price, index) => ({
        title: `TP${index + 1}`, price,
      })),
      { title: "SOURCE HIGH", price: 105.8 },
      { title: "SOURCE LOW", price: 100.2 },
      { title: "PIVOT RESISTANCE", price: 106 },
      { title: "PIVOT SUPPORT", price: 100.6 },
    ]);
    expect(renderer.lines.filter((line) => line.axisLabelVisible).map((line) => line.title))
      .toEqual(["SPOT"]);
    expect(renderer.lines.map(({ title, color }) => ({ title, color }))).toEqual([
      { title: "SPOT", color: brandPalette.gold },
      { title: "ENTRY", color: chartContextPalette.entry },
      { title: long ? "BUY ENTRY" : "SELL ENTRY", color: long ? chartContextPalette.long : chartContextPalette.short },
      { title: "STOP", color: chartContextPalette.risk },
      ...[1, 2, 3].map((index) => ({ title: `TP${index}`, color: chartContextPalette.target })),
      { title: "SOURCE HIGH", color: chartContextPalette.source },
      { title: "SOURCE LOW", color: chartContextPalette.source },
      { title: "PIVOT RESISTANCE", color: chartContextPalette.pivot },
      { title: "PIVOT SUPPORT", color: chartContextPalette.pivot },
    ]);

    renderer.update({ ...data, visibleLayers: {
      entries: false, targets: false, stops: false, sources: false, pivots: false,
    } });
    expect(renderer.lines.map((line) => line.title)).toEqual(["SPOT"]);
    renderer.update(data);
    expect(renderer.lines).toHaveLength(11);
  });

  it("replaces the long plan completely when the evaluation turns short", () => {
    const renderer = overlayRenderer();
    renderer.update(payload("LONG"));
    renderer.update(payload("SHORT"));
    expect(renderer.lines.some((line) => line.title === "BUY ENTRY")).toBe(false);
    expect(renderer.lines.find((line) => line.title === "STOP")?.price).toBe(107.1);
    expect(renderer.lines.find((line) => line.title === "TP1")?.price).toBe(104.2);
    expect(renderer.lines).toHaveLength(11);
  });

  it("toggles source and pivot layers independently without hiding the plan", () => {
    const renderer = overlayRenderer();
    const data = payload("LONG");
    renderer.update({ ...data, visibleLayers: { ...data.visibleLayers, sources: false } });
    expect(renderer.lines.filter((line) => line.title.startsWith("SOURCE"))).toHaveLength(0);
    expect(renderer.lines.filter((line) => line.title.startsWith("PIVOT"))).toHaveLength(2);
    renderer.update({ ...data, visibleLayers: { ...data.visibleLayers, pivots: false } });
    expect(renderer.lines.filter((line) => line.title.startsWith("SOURCE"))).toHaveLength(2);
    expect(renderer.lines.filter((line) => line.title.startsWith("PIVOT"))).toHaveLength(0);
    expect(renderer.lines.find((line) => line.title === "BUY ENTRY")?.price).toBe(106.3);
  });

  it.each(["STALE", "FALLBACK", "ERROR"])(
    "removes existing strategy overlays when candles become %s",
    (dataState) => {
      const renderer = overlayRenderer();
      const data = payload("LONG");
      renderer.update(data);
      renderer.update({ ...data, dataState });
      expect(renderer.lines.map((line) => line.title)).toEqual(["SPOT"]);
    },
  );

  it("removes overlays for display-only history or a withheld validation result", () => {
    const renderer = overlayRenderer();
    const data = payload("SHORT");
    renderer.update(data);
    renderer.update({ ...data, displayOnly: true });
    expect(renderer.lines.map((line) => line.title)).toEqual(["SPOT"]);
    renderer.update(data);
    renderer.update({ ...data, levels: undefined });
    expect(renderer.lines.map((line) => line.title)).toEqual(["SPOT"]);
  });
});
