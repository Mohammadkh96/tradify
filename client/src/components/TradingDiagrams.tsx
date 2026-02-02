import { cn } from "@/lib/utils";

interface CandlestickProps {
  type: "bullish" | "bearish";
  height?: number;
  wickTop?: number;
  wickBottom?: number;
}

function Candlestick({ type, height = 40, wickTop = 10, wickBottom = 10 }: CandlestickProps) {
  const isBullish = type === "bullish";
  return (
    <div className="flex flex-col items-center">
      <div 
        className={cn("w-0.5", isBullish ? "bg-emerald-500" : "bg-rose-500")}
        style={{ height: `${wickTop}px` }}
      />
      <div 
        className={cn(
          "w-4 rounded-sm",
          isBullish ? "bg-emerald-500" : "bg-rose-500"
        )}
        style={{ height: `${height}px` }}
      />
      <div 
        className={cn("w-0.5", isBullish ? "bg-emerald-500" : "bg-rose-500")}
        style={{ height: `${wickBottom}px` }}
      />
    </div>
  );
}

export function OrderBlockDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Order Block Formation</h4>
      <div className="flex items-end gap-1 h-40 justify-center">
        <Candlestick type="bullish" height={30} wickTop={8} wickBottom={12} />
        <Candlestick type="bullish" height={25} wickTop={6} wickBottom={8} />
        <Candlestick type="bearish" height={20} wickTop={15} wickBottom={5} />
        <div className="relative">
          <Candlestick type="bearish" height={50} wickTop={5} wickBottom={3} />
          <div className="absolute -left-8 top-0 w-20 h-12 border-2 border-dashed border-amber-500 rounded opacity-60" />
          <span className="absolute -left-10 -top-6 text-[10px] font-bold text-amber-500">ORDER BLOCK</span>
        </div>
        <Candlestick type="bearish" height={45} wickTop={8} wickBottom={5} />
        <Candlestick type="bearish" height={35} wickTop={10} wickBottom={8} />
        <Candlestick type="bullish" height={20} wickTop={5} wickBottom={10} />
        <Candlestick type="bullish" height={25} wickTop={8} wickBottom={6} />
        <div className="relative">
          <Candlestick type="bullish" height={40} wickTop={5} wickBottom={3} />
          <span className="absolute -right-8 top-1/2 text-[10px] font-bold text-emerald-500">MITIGATED</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Price returns to the order block zone and reacts, confirming institutional interest
      </p>
    </div>
  );
}

export function FVGDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Fair Value Gap (FVG)</h4>
      <div className="flex items-end gap-1 h-40 justify-center relative">
        <Candlestick type="bullish" height={25} wickTop={8} wickBottom={10} />
        <Candlestick type="bullish" height={30} wickTop={6} wickBottom={8} />
        <div className="relative">
          <Candlestick type="bullish" height={20} wickTop={5} wickBottom={15} />
          <span className="absolute -left-4 bottom-0 text-[8px] text-muted-foreground">C1</span>
        </div>
        <div className="relative flex flex-col items-center">
          <div className="absolute -top-16 w-5 h-8 bg-cyan-500/20 border border-cyan-500/50 rounded-sm" />
          <span className="absolute -top-20 text-[10px] font-bold text-cyan-500">FVG</span>
          <Candlestick type="bullish" height={55} wickTop={3} wickBottom={2} />
          <span className="absolute -left-4 bottom-0 text-[8px] text-muted-foreground">C2</span>
        </div>
        <div className="relative">
          <Candlestick type="bullish" height={25} wickTop={12} wickBottom={5} />
          <span className="absolute -left-4 bottom-0 text-[8px] text-muted-foreground">C3</span>
        </div>
        <Candlestick type="bullish" height={20} wickTop={8} wickBottom={10} />
        <Candlestick type="bearish" height={15} wickTop={10} wickBottom={8} />
        <Candlestick type="bullish" height={18} wickTop={6} wickBottom={12} />
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Gap between C1 high and C3 low creates an imbalance zone where price often returns
      </p>
    </div>
  );
}

export function LiquiditySweepDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Liquidity Sweep</h4>
      <div className="relative h-48">
        <div className="absolute top-4 left-0 right-0 border-t-2 border-dashed border-rose-500/50" />
        <span className="absolute top-1 left-2 text-[10px] font-bold text-rose-500">SWING HIGH</span>
        <div className="flex items-end gap-1 h-32 justify-center pt-8">
          <Candlestick type="bullish" height={20} wickTop={5} wickBottom={8} />
          <Candlestick type="bullish" height={30} wickTop={8} wickBottom={6} />
          <Candlestick type="bullish" height={40} wickTop={6} wickBottom={5} />
          <div className="relative">
            <Candlestick type="bullish" height={25} wickTop={25} wickBottom={3} />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2">
              <span className="text-[8px] font-bold text-amber-500 whitespace-nowrap">STOP HUNT</span>
            </div>
          </div>
          <Candlestick type="bearish" height={45} wickTop={5} wickBottom={8} />
          <Candlestick type="bearish" height={50} wickTop={8} wickBottom={5} />
          <Candlestick type="bearish" height={40} wickTop={6} wickBottom={10} />
        </div>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Price sweeps above swing high, triggers stop losses, then reverses sharply
        </p>
      </div>
    </div>
  );
}

export function BOSCHoCHDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">BOS vs CHoCH</h4>
      <div className="grid grid-cols-2 gap-6">
        <div className="relative h-36">
          <div className="absolute top-8 left-4 right-4 border-t-2 border-dashed border-muted-foreground/50" />
          <span className="absolute top-5 left-4 text-[8px] text-muted-foreground">PREV HIGH</span>
          <div className="flex items-end gap-0.5 h-28 justify-center pt-12">
            <Candlestick type="bullish" height={15} wickTop={3} wickBottom={4} />
            <Candlestick type="bullish" height={20} wickTop={4} wickBottom={3} />
            <Candlestick type="bearish" height={12} wickTop={5} wickBottom={4} />
            <Candlestick type="bullish" height={25} wickTop={3} wickBottom={3} />
            <Candlestick type="bullish" height={30} wickTop={4} wickBottom={2} />
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold text-emerald-500 whitespace-nowrap">BOS (Trend Continues)</span>
          </div>
        </div>
        <div className="relative h-36">
          <div className="absolute bottom-16 left-4 right-4 border-t-2 border-dashed border-muted-foreground/50" />
          <span className="absolute bottom-12 left-4 text-[8px] text-muted-foreground">PREV LOW</span>
          <div className="flex items-start gap-0.5 h-28 justify-center">
            <Candlestick type="bullish" height={20} wickTop={4} wickBottom={5} />
            <Candlestick type="bullish" height={15} wickTop={5} wickBottom={4} />
            <Candlestick type="bearish" height={18} wickTop={3} wickBottom={6} />
            <Candlestick type="bearish" height={25} wickTop={4} wickBottom={8} />
            <Candlestick type="bearish" height={35} wickTop={3} wickBottom={5} />
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold text-rose-500 whitespace-nowrap">CHoCH (Trend Reversal)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CandlestickPatternsDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Key Candlestick Patterns</h4>
      <div className="grid grid-cols-4 gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 flex items-end">
            <Candlestick type="bullish" height={8} wickTop={25} wickBottom={5} />
          </div>
          <span className="text-[10px] font-bold text-emerald-500">Hammer</span>
          <span className="text-[8px] text-muted-foreground text-center">Bullish reversal</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 flex items-end">
            <Candlestick type="bearish" height={8} wickTop={5} wickBottom={25} />
          </div>
          <span className="text-[10px] font-bold text-rose-500">Shooting Star</span>
          <span className="text-[8px] text-muted-foreground text-center">Bearish reversal</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 flex items-end gap-0.5">
            <Candlestick type="bearish" height={30} wickTop={5} wickBottom={5} />
            <Candlestick type="bullish" height={40} wickTop={3} wickBottom={3} />
          </div>
          <span className="text-[10px] font-bold text-emerald-500">Engulfing</span>
          <span className="text-[8px] text-muted-foreground text-center">Strong reversal</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-20 flex items-end">
            <Candlestick type="bullish" height={3} wickTop={20} wickBottom={20} />
          </div>
          <span className="text-[10px] font-bold text-amber-500">Doji</span>
          <span className="text-[8px] text-muted-foreground text-center">Indecision</span>
        </div>
      </div>
    </div>
  );
}

export function SessionsDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Trading Sessions (UTC)</h4>
      <div className="relative h-12">
        <div className="absolute inset-y-0 left-0 w-full bg-muted rounded-full" />
        <div className="absolute inset-y-0 left-0 w-1/4 bg-blue-500/30 rounded-l-full border-r border-blue-500/50">
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-400">ASIAN</span>
        </div>
        <div className="absolute inset-y-0 left-1/4 w-1/4 bg-amber-500/30 border-r border-amber-500/50">
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-amber-400">LONDON</span>
        </div>
        <div className="absolute inset-y-0 left-1/2 w-1/4 bg-emerald-500/30 border-r border-emerald-500/50">
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-emerald-400">NY</span>
        </div>
        <div className="absolute inset-y-0 left-3/4 w-1/4 bg-purple-500/30 rounded-r-full">
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-400">OFF-HOURS</span>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-[8px] text-muted-foreground">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        London-NY overlap (12:00-16:00 UTC) has highest volume and volatility
      </p>
    </div>
  );
}

export function RiskRewardDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-4">Risk:Reward Visualization</h4>
      <div className="relative h-40 flex items-center justify-center">
        <div className="relative w-48">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-emerald-500" />
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 -translate-y-full">
            <span className="text-[10px] font-bold text-emerald-500">TP: +3R</span>
          </div>
          <div className="w-full h-8 bg-muted rounded flex items-center justify-center border-2 border-foreground/20">
            <span className="text-[10px] font-bold">ENTRY</span>
          </div>
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-rose-500" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold text-rose-500">SL: -1R</span>
          </div>
        </div>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-right">
          <div className="text-emerald-500 font-bold text-sm">3:1 RR</div>
          <div className="text-[10px] text-muted-foreground">Risk $100 → Win $300</div>
        </div>
      </div>
    </div>
  );
}

export const DIAGRAM_TYPES = {
  "order-block": OrderBlockDiagram,
  "fvg": FVGDiagram,
  "liquidity-sweep": LiquiditySweepDiagram,
  "bos-choch": BOSCHoCHDiagram,
  "candlestick-patterns": CandlestickPatternsDiagram,
  "sessions": SessionsDiagram,
  "risk-reward": RiskRewardDiagram,
} as const;

export type DiagramType = keyof typeof DIAGRAM_TYPES;
