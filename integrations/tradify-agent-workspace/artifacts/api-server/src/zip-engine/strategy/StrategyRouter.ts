import { Candle } from "../market/types";
import { IStrategy, StrategySignal } from "./types";
import { DGv8Engine } from "./DGv8Engine";
import { DGv8FXEngine } from "./DGv8FXEngine";
import { BBBEngine } from "./BBBEngine";
import { BBBGold3SEngine } from "./BBBGold3SEngine";

export class StrategyRouter {
  private dgv8Engine: DGv8Engine;
  private dgv8FxEngine: DGv8FXEngine;
  private bbbEngine: BBBEngine;
  private bbbGold3sEngine: BBBGold3SEngine;

  constructor() {
    this.dgv8Engine = new DGv8Engine();
    this.dgv8FxEngine = new DGv8FXEngine();
    this.bbbEngine = new BBBEngine();
    this.bbbGold3sEngine = new BBBGold3SEngine();
  }

  public evaluate(
    symbol: string,
    providerSymbol: string,
    provider: string,
    candles: Candle[],
    marketDataTrusted: boolean = true,
    targetStrategyId?: string | null,
  ): StrategySignal {
    const uppercaseSymbol = symbol ? symbol.toUpperCase() : "";

    // Assignment resolution is performed by the database-backed control plane
    // before this router is called. A missing target must never pick a fallback.
    const stratId = targetStrategyId ? targetStrategyId.toUpperCase() : null;

    if (stratId === "DGV8") {
      return this.dgv8Engine.evaluate(
        uppercaseSymbol,
        providerSymbol,
        provider,
        candles,
        marketDataTrusted,
      );
    }

    if (stratId === "DGV8_FX") {
      return this.dgv8FxEngine.evaluate(
        uppercaseSymbol,
        providerSymbol,
        provider,
        candles,
        marketDataTrusted,
      );
    }

    if (stratId === "BBB") {
      return this.bbbEngine.evaluate(
        uppercaseSymbol,
        providerSymbol,
        provider,
        candles,
        marketDataTrusted,
      );
    }

    if (stratId === "BBB_GOLD_3S") {
      return this.bbbGold3sEngine.evaluate(
        uppercaseSymbol,
        providerSymbol,
        provider,
        candles,
        marketDataTrusted,
      );
    }

    const latestConfirmedTime =
      candles && candles.length > 0 ? candles[candles.length - 1].time : Date.now();

    return {
      id: `NO-STRAT-${uppercaseSymbol}-${Date.now()}`,
      strategy: "DGV8",
      strategyVersion: "1.0.0",
      symbol: uppercaseSymbol,
      tradingDay: new Date(latestConfirmedTime).toISOString().slice(0, 10),
      timeframe: "M15",
      direction: "NONE",
      action: "NO_STRATEGY_CONFIGURED",
      lifecycleStatus: "NO_QUALIFIED_SETUP",
      detectedAt: latestConfirmedTime,
      targets: [],
      marketDataSnapshot: {
        provider: provider || "Unknown",
        providerSymbol: providerSymbol || uppercaseSymbol,
        latestConfirmedCandleTime: latestConfirmedTime,
      },
      strategyFacts: {},
      reasons: [
        `No strategy engine configured for symbol '${uppercaseSymbol}' with strategy '${stratId}'.`,
      ],
    };
  }
}

export const strategyRouter = new StrategyRouter();
