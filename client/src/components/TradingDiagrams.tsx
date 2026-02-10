import { cn } from "@/lib/utils";

interface SVGCandleData {
  o: number;
  h: number;
  l: number;
  c: number;
}

function priceToY(price: number, minP: number, maxP: number, chartH: number, pad = 20): number {
  const range = maxP - minP || 1;
  return pad + ((maxP - price) / range) * (chartH - 2 * pad);
}

function SVGCandle({ d, x, w, minP, maxP, chartH }: { d: SVGCandleData; x: number; w: number; minP: number; maxP: number; chartH: number }) {
  const isBull = d.c >= d.o;
  const color = isBull ? "#10b981" : "#ef4444";
  const bodyTop = priceToY(Math.max(d.o, d.c), minP, maxP, chartH);
  const bodyBot = priceToY(Math.min(d.o, d.c), minP, maxP, chartH);
  const bodyH = Math.max(bodyBot - bodyTop, 1);
  const wickTop = priceToY(d.h, minP, maxP, chartH);
  const wickBot = priceToY(d.l, minP, maxP, chartH);
  const cx = x + w / 2;

  return (
    <g>
      <line x1={cx} y1={wickTop} x2={cx} y2={wickBot} stroke={color} strokeWidth={1} />
      <rect x={x + 1} y={bodyTop} width={w - 2} height={bodyH} fill={isBull ? color : color} rx={1} />
    </g>
  );
}

function ChartFrame({ candles, width, height, annotations }: {
  candles: SVGCandleData[];
  width: number;
  height: number;
  annotations?: (minP: number, maxP: number) => React.ReactNode;
}) {
  const allH = candles.map(c => c.h);
  const allL = candles.map(c => c.l);
  const maxP = Math.max(...allH);
  const minP = Math.min(...allL);
  const range = maxP - minP || 1;
  const padMin = minP - range * 0.08;
  const padMax = maxP + range * 0.08;
  const cw = Math.min(14, (width - 20) / candles.length);
  const gap = 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      <rect x={0} y={0} width={width} height={height} fill="transparent" />
      {candles.map((d, i) => (
        <SVGCandle key={i} d={d} x={10 + i * (cw + gap)} w={cw} minP={padMin} maxP={padMax} chartH={height} />
      ))}
      {annotations && annotations(padMin, padMax)}
    </svg>
  );
}

export function MarketStructureDiagram() {
  const candles: SVGCandleData[] = [
    { o: 100, h: 103, l: 98, c: 102 },
    { o: 102, h: 105, l: 101, c: 104 },
    { o: 104, h: 106, l: 102, c: 103 },
    { o: 103, h: 107, l: 102, c: 106 },
    { o: 106, h: 110, l: 105, c: 109 },
    { o: 109, h: 111, l: 107, c: 108 },
    { o: 108, h: 109, l: 106, c: 107 },
    { o: 107, h: 112, l: 106, c: 111 },
    { o: 111, h: 115, l: 110, c: 114 },
    { o: 114, h: 116, l: 112, c: 113 },
    { o: 113, h: 114, l: 111, c: 112 },
    { o: 112, h: 117, l: 111, c: 116 },
    { o: 116, h: 119, l: 115, c: 118 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Bullish Market Structure</h4>
      <p className="text-xs text-muted-foreground mb-4">Higher Highs (HH) and Higher Lows (HL) define an uptrend</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const hh1 = priceToY(110, minP, maxP, H);
        const hl1 = priceToY(106, minP, maxP, H);
        const hh2 = priceToY(115, minP, maxP, H);
        const hl2 = priceToY(111, minP, maxP, H);
        const hh3 = priceToY(119, minP, maxP, H);
        return (
          <g>
            <line x1={10 + 4 * 16} y1={hh1} x2={10 + 8 * 16} y2={hh2} stroke="#10b981" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
            <line x1={10 + 8 * 16} y1={hh2} x2={10 + 12 * 16} y2={hh3} stroke="#10b981" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
            <line x1={10 + 3 * 16} y1={hl1} x2={10 + 7 * 16} y2={hl2} stroke="#10b981" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
            <circle cx={10 + 4 * 16 + 7} cy={hh1} r={3} fill="#10b981" />
            <text x={10 + 4 * 16 + 14} y={hh1 + 4} fill="#10b981" fontSize={9} fontWeight="bold">HH</text>
            <circle cx={10 + 8 * 16 + 7} cy={hh2} r={3} fill="#10b981" />
            <text x={10 + 8 * 16 + 14} y={hh2 + 4} fill="#10b981" fontSize={9} fontWeight="bold">HH</text>
            <circle cx={10 + 12 * 16 + 7} cy={hh3} r={3} fill="#10b981" />
            <text x={10 + 12 * 16 + 14} y={hh3 + 4} fill="#10b981" fontSize={9} fontWeight="bold">HH</text>
            <circle cx={10 + 3 * 16 + 7} cy={hl1} r={3} fill="#3b82f6" />
            <text x={10 + 3 * 16 - 20} y={hl1 + 4} fill="#3b82f6" fontSize={9} fontWeight="bold">HL</text>
            <circle cx={10 + 7 * 16 + 7} cy={hl2} r={3} fill="#3b82f6" />
            <text x={10 + 7 * 16 - 20} y={hl2 + 4} fill="#3b82f6" fontSize={9} fontWeight="bold">HL</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        A valid uptrend requires price to make consecutive higher highs and higher lows. A break of a higher low signals potential trend change.
      </p>
    </div>
  );
}

export function OrderBlockDiagram() {
  const candles: SVGCandleData[] = [
    { o: 110, h: 112, l: 108, c: 111 },
    { o: 111, h: 114, l: 110, c: 113 },
    { o: 113, h: 115, l: 112, c: 114 },
    { o: 114, h: 115, l: 111, c: 112 },
    { o: 112, h: 113, l: 108, c: 109 },
    { o: 109, h: 110, l: 105, c: 106 },
    { o: 106, h: 107, l: 103, c: 104 },
    { o: 104, h: 106, l: 102, c: 105 },
    { o: 105, h: 108, l: 104, c: 107 },
    { o: 107, h: 110, l: 106, c: 109 },
    { o: 109, h: 113, l: 108, c: 112 },
    { o: 112, h: 115, l: 111, c: 114 },
    { o: 114, h: 116, l: 112, c: 113 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Bullish Order Block</h4>
      <p className="text-xs text-muted-foreground mb-4">Last bearish candle before an impulsive bullish move that breaks structure</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const obTop = priceToY(115, minP, maxP, H);
        const obBot = priceToY(111, minP, maxP, H);
        const mitTop = priceToY(115, minP, maxP, H);
        const mitBot = priceToY(111, minP, maxP, H);
        return (
          <g>
            <rect x={10 + 3 * 16 - 4} y={obTop} width={20} height={obBot - obTop} fill="#f59e0b" opacity={0.15} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" rx={2} />
            <text x={10 + 3 * 16 - 2} y={obTop - 4} fill="#f59e0b" fontSize={8} fontWeight="bold">OB</text>
            <rect x={10 + 7 * 16 - 4} y={mitTop} width={80} height={mitBot - mitTop} fill="#f59e0b" opacity={0.06} rx={2} />
            <line x1={10 + 3 * 16 + 16} y1={obTop} x2={10 + 10 * 16} y2={obTop} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
            <line x1={10 + 3 * 16 + 16} y1={obBot} x2={10 + 10 * 16} y2={obBot} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.5} />
            <text x={10 + 10 * 16 + 4} y={(obTop + obBot) / 2 + 3} fill="#10b981" fontSize={8} fontWeight="bold">Mitigated</text>
            <line x1={10 + 4 * 16 + 7} y1={priceToY(105, minP, maxP, H)} x2={10 + 4 * 16 + 7} y2={priceToY(115, minP, maxP, H)} stroke="#10b981" strokeWidth={1.5} markerEnd="url(#arrowG)" opacity={0.6} />
            <defs><marker id="arrowG" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#10b981" /></marker></defs>
          </g>
        );
      }} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-amber-500/30 border border-amber-500 rounded-sm" /><span className="text-muted-foreground">Order Block zone</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-emerald-500" /><span className="text-muted-foreground">Impulse move</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-2 bg-amber-500/10 rounded-sm" /><span className="text-muted-foreground">Mitigation zone</span></div>
      </div>
    </div>
  );
}

export function FVGDiagram() {
  const candles: SVGCandleData[] = [
    { o: 100, h: 102, l: 98, c: 101 },
    { o: 101, h: 103, l: 100, c: 102 },
    { o: 102, h: 104, l: 101, c: 103 },
    { o: 103, h: 105, l: 102, c: 104 },
    { o: 104, h: 110, l: 103.5, c: 109 },
    { o: 109, h: 113, l: 108, c: 112 },
    { o: 112, h: 114, l: 111, c: 113 },
    { o: 113, h: 114, l: 110, c: 111 },
    { o: 111, h: 112, l: 108, c: 109 },
    { o: 109, h: 110, l: 106, c: 107 },
    { o: 107, h: 109, l: 105, c: 108 },
    { o: 108, h: 112, l: 107, c: 111 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Fair Value Gap (FVG)</h4>
      <p className="text-xs text-muted-foreground mb-4">Imbalance created when Candle 3's low is above Candle 1's high</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const c1High = priceToY(105, minP, maxP, H);
        const c3Low = priceToY(108, minP, maxP, H);
        return (
          <g>
            <rect x={10 + 3 * 16} y={c1High} width={3 * 16} height={c3Low - c1High} fill="#06b6d4" opacity={0.15} stroke="#06b6d4" strokeWidth={1} strokeDasharray="3,2" rx={2} />
            <text x={10 + 3.2 * 16} y={c1High - 4} fill="#06b6d4" fontSize={8} fontWeight="bold">FVG</text>
            <text x={10 + 3 * 16 - 18} y={c1High + 3} fill="#94a3b8" fontSize={7}>C1 H</text>
            <text x={10 + 5 * 16 + 16} y={c3Low + 3} fill="#94a3b8" fontSize={7}>C3 L</text>
            <line x1={10 + 3 * 16} y1={c1High} x2={10 + 11 * 16} y2={c1High} stroke="#06b6d4" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
            <line x1={10 + 5 * 16 + 14} y1={c3Low} x2={10 + 11 * 16} y2={c3Low} stroke="#06b6d4" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4} />
            <rect x={10 + 8 * 16} y={c1High} width={3 * 16} height={c3Low - c1High} fill="#06b6d4" opacity={0.06} rx={2} />
            <text x={10 + 9 * 16} y={(c1High + c3Low) / 2 + 3} fill="#06b6d4" fontSize={7} fontWeight="bold">Fill zone</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        Price often returns to fill the FVG before continuing in the original direction. The gap between C1 high and C3 low is the imbalance.
      </p>
    </div>
  );
}

export function LiquiditySweepDiagram() {
  const candles: SVGCandleData[] = [
    { o: 105, h: 107, l: 103, c: 106 },
    { o: 106, h: 109, l: 105, c: 108 },
    { o: 108, h: 111, l: 107, c: 110 },
    { o: 110, h: 112, l: 108, c: 109 },
    { o: 109, h: 110, l: 107, c: 108 },
    { o: 108, h: 110, l: 106, c: 109 },
    { o: 109, h: 111, l: 108, c: 110 },
    { o: 110, h: 114, l: 109, c: 111 },
    { o: 111, h: 112, l: 106, c: 107 },
    { o: 107, h: 108, l: 103, c: 104 },
    { o: 104, h: 105, l: 101, c: 102 },
    { o: 102, h: 103, l: 99, c: 100 },
  ];
  const W = 340;
  const H = 210;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Liquidity Sweep (Stop Hunt)</h4>
      <p className="text-xs text-muted-foreground mb-4">Institutional move above a swing high to trigger stop losses before reversing</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const swingH = priceToY(112, minP, maxP, H);
        const sweepH = priceToY(114, minP, maxP, H);
        return (
          <g>
            <line x1={10} y1={swingH} x2={W - 10} y2={swingH} stroke="#ef4444" strokeWidth={1} strokeDasharray="5,3" opacity={0.6} />
            <text x={12} y={swingH - 5} fill="#ef4444" fontSize={8} fontWeight="bold">Swing High (Liquidity)</text>
            <rect x={10 + 2 * 16 - 2} y={swingH - 2} width={6 * 16 + 4} height={4} fill="#ef4444" opacity={0.08} />
            <text x={W - 70} y={swingH - 5} fill="#94a3b8" fontSize={7}>Stop losses above</text>
            <line x1={10 + 7 * 16 + 7} y1={sweepH} x2={10 + 7 * 16 + 7} y2={swingH} stroke="#f59e0b" strokeWidth={2} opacity={0.7} />
            <text x={10 + 7 * 16 + 12} y={sweepH + 3} fill="#f59e0b" fontSize={8} fontWeight="bold">Sweep</text>
            <line x1={10 + 8 * 16 + 7} y1={priceToY(111, minP, maxP, H)} x2={10 + 11 * 16 + 7} y2={priceToY(100, minP, maxP, H)} stroke="#ef4444" strokeWidth={1.5} opacity={0.5} />
            <text x={10 + 10 * 16} y={priceToY(100, minP, maxP, H) + 12} fill="#ef4444" fontSize={8} fontWeight="bold">Reversal</text>
          </g>
        );
      }} />
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5"><div className="w-6 h-0.5 bg-red-500 border-dashed" style={{ borderTopWidth: 1, borderStyle: 'dashed' }} /><span className="text-muted-foreground">Liquidity level</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-500/30 rounded-sm" /><span className="text-muted-foreground">Sweep wick above level</span></div>
      </div>
    </div>
  );
}

export function BOSCHoCHDiagram() {
  const bosCandles: SVGCandleData[] = [
    { o: 100, h: 103, l: 99, c: 102 },
    { o: 102, h: 105, l: 101, c: 104 },
    { o: 104, h: 106, l: 103, c: 103.5 },
    { o: 103.5, h: 104, l: 101, c: 102 },
    { o: 102, h: 106, l: 101, c: 105 },
    { o: 105, h: 108, l: 104, c: 107 },
    { o: 107, h: 110, l: 106, c: 109 },
  ];
  const chochCandles: SVGCandleData[] = [
    { o: 110, h: 112, l: 109, c: 111 },
    { o: 111, h: 113, l: 110, c: 112 },
    { o: 112, h: 113, l: 110, c: 111 },
    { o: 111, h: 112, l: 108, c: 109 },
    { o: 109, h: 110, l: 106, c: 107 },
    { o: 107, h: 108, l: 104, c: 105 },
    { o: 105, h: 106, l: 103, c: 104 },
  ];
  const W = 165;
  const H = 160;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">BOS vs CHoCH</h4>
      <p className="text-xs text-muted-foreground mb-4">Break of Structure confirms trend; Change of Character signals reversal</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-emerald-500">Break of Structure (BOS)</span>
          </div>
          <ChartFrame candles={bosCandles} width={W} height={H} annotations={(minP, maxP) => {
            const prevH = priceToY(106, minP, maxP, H);
            return (
              <g>
                <line x1={10} y1={prevH} x2={W - 10} y2={prevH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
                <text x={12} y={prevH - 4} fill="#94a3b8" fontSize={7}>Prev High</text>
                <text x={W / 2 - 25} y={H - 8} fill="#10b981" fontSize={8} fontWeight="bold">Trend continues</text>
              </g>
            );
          }} />
        </div>
        <div>
          <div className="text-center mb-2">
            <span className="text-xs font-bold text-rose-500">Change of Character (CHoCH)</span>
          </div>
          <ChartFrame candles={chochCandles} width={W} height={H} annotations={(minP, maxP) => {
            const prevL = priceToY(109, minP, maxP, H);
            return (
              <g>
                <line x1={10} y1={prevL} x2={W - 10} y2={prevL} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4,3" opacity={0.5} />
                <text x={12} y={prevL + 12} fill="#94a3b8" fontSize={7}>Prev Low</text>
                <text x={W / 2 - 25} y={H - 8} fill="#ef4444" fontSize={8} fontWeight="bold">Trend reversal</text>
              </g>
            );
          }} />
        </div>
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground text-center italic">
        BOS: Price breaks the previous swing high/low in the direction of the trend. CHoCH: Price breaks the previous swing high/low against the trend, signaling a shift.
      </div>
    </div>
  );
}

export function CandlestickPatternsDiagram() {
  const W = 340;
  const H = 180;

  const patterns: { name: string; color: string; desc: string; candles: SVGCandleData[] }[] = [
    { name: "Hammer", color: "#10b981", desc: "Bullish reversal at support", candles: [{ o: 105, h: 106, l: 98, c: 105.5 }] },
    { name: "Shooting Star", color: "#ef4444", desc: "Bearish reversal at resistance", candles: [{ o: 103, h: 110, l: 102, c: 103.5 }] },
    { name: "Bullish Engulfing", color: "#10b981", desc: "Strong bullish reversal", candles: [{ o: 106, h: 107, l: 103, c: 104 }, { o: 103, h: 109, l: 102, c: 108 }] },
    { name: "Bearish Engulfing", color: "#ef4444", desc: "Strong bearish reversal", candles: [{ o: 104, h: 107, l: 103, c: 106 }, { o: 107, h: 108, l: 101, c: 102 }] },
  ];

  const patW = 60;
  const patH = 100;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Key Candlestick Patterns</h4>
      <p className="text-xs text-muted-foreground mb-4">Single and multi-candle reversal patterns used for confirmation</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {patterns.map((pat) => {
          const allH = pat.candles.map(c => c.h);
          const allL = pat.candles.map(c => c.l);
          const maxP = Math.max(...allH) + 1;
          const minP = Math.min(...allL) - 1;
          const cw = pat.candles.length === 1 ? 16 : 14;
          return (
            <div key={pat.name} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-background/50">
              <svg viewBox={`0 0 ${patW} ${patH}`} className="w-full" style={{ maxHeight: patH }}>
                {pat.candles.map((d, i) => (
                  <SVGCandle key={i} d={d} x={patW / 2 - (pat.candles.length * (cw + 2)) / 2 + i * (cw + 2)} w={cw} minP={minP} maxP={maxP} chartH={patH} />
                ))}
              </svg>
              <span className="text-[10px] font-bold" style={{ color: pat.color }}>{pat.name}</span>
              <span className="text-[8px] text-muted-foreground text-center leading-tight">{pat.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SessionsDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Trading Sessions (UTC)</h4>
      <p className="text-xs text-muted-foreground mb-4">Major trading sessions and their overlap periods</p>
      <svg viewBox="0 0 340 80" className="w-full" style={{ maxHeight: 80 }}>
        <rect x={10} y={15} width={320} height={30} fill="hsl(var(--muted))" rx={6} />
        <rect x={10} y={15} width={75} height={30} fill="#3b82f620" rx={6} />
        <text x={47} y={34} fill="#60a5fa" fontSize={8} fontWeight="bold" textAnchor="middle">ASIAN</text>
        <rect x={85} y={15} width={90} height={30} fill="#f59e0b20" />
        <text x={130} y={34} fill="#fbbf24" fontSize={8} fontWeight="bold" textAnchor="middle">LONDON</text>
        <rect x={145} y={15} width={60} height={30} fill="#8b5cf620" />
        <text x={175} y={34} fill="#a78bfa" fontSize={7} fontWeight="bold" textAnchor="middle">OVERLAP</text>
        <rect x={175} y={15} width={90} height={30} fill="#10b98120" />
        <text x={220} y={34} fill="#34d399" fontSize={8} fontWeight="bold" textAnchor="middle">NEW YORK</text>
        <rect x={265} y={15} width={65} height={30} fill="#6b728020" rx={6} />
        <text x={297} y={34} fill="#9ca3af" fontSize={7} fontWeight="bold" textAnchor="middle">OFF</text>
        <text x={10} y={60} fill="#9ca3af" fontSize={7}>00:00</text>
        <text x={85} y={60} fill="#9ca3af" fontSize={7}>07:00</text>
        <text x={145} y={60} fill="#9ca3af" fontSize={7}>12:00</text>
        <text x={210} y={60} fill="#9ca3af" fontSize={7}>16:00</text>
        <text x={265} y={60} fill="#9ca3af" fontSize={7}>21:00</text>
        <text x={320} y={60} fill="#9ca3af" fontSize={7} textAnchor="end">24:00</text>
        <line x1={145} y1={47} x2={205} y2={47} stroke="#a78bfa" strokeWidth={2} />
        <text x={175} y={72} fill="#a78bfa" fontSize={7} fontWeight="bold" textAnchor="middle">Highest Volume</text>
      </svg>
    </div>
  );
}

export function RiskRewardDiagram() {
  const candles: SVGCandleData[] = [
    { o: 104, h: 105, l: 102, c: 103 },
    { o: 103, h: 104, l: 101, c: 102 },
    { o: 102, h: 103, l: 100, c: 101 },
    { o: 101, h: 102, l: 100, c: 101.5 },
    { o: 101.5, h: 104, l: 101, c: 103 },
    { o: 103, h: 106, l: 102, c: 105 },
    { o: 105, h: 108, l: 104, c: 107 },
    { o: 107, h: 110, l: 106, c: 109 },
    { o: 109, h: 112, l: 108, c: 111 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Risk:Reward Ratio (1:3)</h4>
      <p className="text-xs text-muted-foreground mb-4">Proper trade setup with defined stop loss and take profit levels</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const entry = priceToY(101.5, minP, maxP, H);
        const sl = priceToY(100, minP, maxP, H);
        const tp = priceToY(106, minP, maxP, H);
        return (
          <g>
            <line x1={10 + 3 * 16} y1={entry} x2={W - 10} y2={entry} stroke="#3b82f6" strokeWidth={1} strokeDasharray="5,3" />
            <text x={W - 45} y={entry - 4} fill="#3b82f6" fontSize={8} fontWeight="bold">Entry</text>
            <rect x={10 + 3 * 16} y={entry} width={W - 20 - 3 * 16} height={sl - entry} fill="#ef4444" opacity={0.08} />
            <line x1={10 + 3 * 16} y1={sl} x2={W - 10} y2={sl} stroke="#ef4444" strokeWidth={1} strokeDasharray="5,3" />
            <text x={W - 55} y={sl + 12} fill="#ef4444" fontSize={8} fontWeight="bold">SL (-1R)</text>
            <rect x={10 + 3 * 16} y={tp} width={W - 20 - 3 * 16} height={entry - tp} fill="#10b981" opacity={0.08} />
            <line x1={10 + 3 * 16} y1={tp} x2={W - 10} y2={tp} stroke="#10b981" strokeWidth={1} strokeDasharray="5,3" />
            <text x={W - 60} y={tp - 4} fill="#10b981" fontSize={8} fontWeight="bold">TP (+3R)</text>
            <text x={W - 55} y={(entry + sl) / 2 + 3} fill="#ef4444" fontSize={7}>Risk: $100</text>
            <text x={W - 70} y={(tp + entry) / 2 + 3} fill="#10b981" fontSize={7}>Reward: $300</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        Minimum 1:2 R:R recommended. With 1:3 R:R, you only need a 25% win rate to break even.
      </p>
    </div>
  );
}

export function BreakerBlockDiagram() {
  const candles: SVGCandleData[] = [
    { o: 100, h: 103, l: 99, c: 102 },
    { o: 102, h: 106, l: 101, c: 105 },
    { o: 105, h: 108, l: 104, c: 107 },
    { o: 107, h: 109, l: 105, c: 106 },
    { o: 106, h: 107, l: 103, c: 104 },
    { o: 104, h: 105, l: 101, c: 102 },
    { o: 102, h: 103, l: 99, c: 100 },
    { o: 100, h: 101, l: 97, c: 98 },
    { o: 98, h: 100, l: 97, c: 99 },
    { o: 99, h: 102, l: 98, c: 101 },
    { o: 101, h: 105, l: 100, c: 104 },
    { o: 104, h: 107, l: 103, c: 106 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Breaker Block</h4>
      <p className="text-xs text-muted-foreground mb-4">A failed order block that becomes support/resistance on the opposite side</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const obTop = priceToY(109, minP, maxP, H);
        const obBot = priceToY(105, minP, maxP, H);
        return (
          <g>
            <rect x={10 + 2 * 16} y={obTop} width={20} height={obBot - obTop} fill="#ef4444" opacity={0.15} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,2" rx={2} />
            <text x={10 + 2 * 16} y={obTop - 4} fill="#ef4444" fontSize={7} fontWeight="bold">Failed OB</text>
            <line x1={10 + 4 * 16} y1={obBot} x2={10 + 11 * 16} y2={obBot} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            <rect x={10 + 9 * 16} y={obBot - 4} width={3 * 16} height={8} fill="#8b5cf6" opacity={0.15} rx={2} />
            <text x={10 + 9.2 * 16} y={obBot + 14} fill="#8b5cf6" fontSize={8} fontWeight="bold">Breaker (Support)</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        When an order block fails and price breaks through it, the zone flips polarity and becomes a breaker block.
      </p>
    </div>
  );
}

export function InducementDiagram() {
  const candles: SVGCandleData[] = [
    { o: 105, h: 107, l: 104, c: 106 },
    { o: 106, h: 109, l: 105, c: 108 },
    { o: 108, h: 110, l: 107, c: 109 },
    { o: 109, h: 111, l: 107, c: 108 },
    { o: 108, h: 109, l: 106, c: 107 },
    { o: 107, h: 108, l: 105, c: 106 },
    { o: 106, h: 108, l: 105, c: 107 },
    { o: 107, h: 108.5, l: 104, c: 104.5 },
    { o: 104.5, h: 105, l: 102, c: 103 },
    { o: 103, h: 105, l: 101, c: 104 },
    { o: 104, h: 107, l: 103, c: 106 },
    { o: 106, h: 109, l: 105, c: 108 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Inducement</h4>
      <p className="text-xs text-muted-foreground mb-4">Minor liquidity created to bait retail traders before sweeping the real target</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const minorLow = priceToY(105, minP, maxP, H);
        const majorLow = priceToY(104, minP, maxP, H);
        const sweepLow = priceToY(102, minP, maxP, H);
        return (
          <g>
            <line x1={10 + 1 * 16} y1={minorLow} x2={10 + 7 * 16} y2={minorLow} stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
            <text x={10 + 1 * 16} y={minorLow + 12} fill="#f59e0b" fontSize={7} fontWeight="bold">Minor Low (Inducement)</text>
            <line x1={10 + 0 * 16} y1={majorLow} x2={10 + 8 * 16} y2={majorLow} stroke="#ef4444" strokeWidth={1} strokeDasharray="5,3" opacity={0.4} />
            <text x={10} y={majorLow + 12} fill="#94a3b8" fontSize={7}>Real target level</text>
            <circle cx={10 + 7 * 16 + 7} cy={sweepLow} r={4} fill="none" stroke="#ef4444" strokeWidth={1.5} />
            <text x={10 + 7 * 16 + 14} y={sweepLow + 3} fill="#ef4444" fontSize={7} fontWeight="bold">Swept</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        Smart money creates minor swing points to induce retail entries, then sweeps below to collect liquidity before the real move.
      </p>
    </div>
  );
}

export function MultiTimeframeDiagram() {
  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Multi-Timeframe Analysis</h4>
      <p className="text-xs text-muted-foreground mb-4">Top-down approach: Higher timeframe sets bias, lower timeframe provides entry</p>
      <svg viewBox="0 0 340 160" className="w-full" style={{ maxHeight: 160 }}>
        <rect x={10} y={10} width={100} height={55} rx={6} fill="#10b98110" stroke="#10b981" strokeWidth={1} />
        <text x={60} y={28} fill="#10b981" fontSize={9} fontWeight="bold" textAnchor="middle">HTF (4H/Daily)</text>
        <text x={60} y={42} fill="#94a3b8" fontSize={7} textAnchor="middle">Trend Direction</text>
        <text x={60} y={54} fill="#94a3b8" fontSize={7} textAnchor="middle">Key S/R Levels</text>

        <rect x={120} y={10} width={100} height={55} rx={6} fill="#3b82f610" stroke="#3b82f6" strokeWidth={1} />
        <text x={170} y={28} fill="#3b82f6" fontSize={9} fontWeight="bold" textAnchor="middle">MTF (1H)</text>
        <text x={170} y={42} fill="#94a3b8" fontSize={7} textAnchor="middle">Market Structure</text>
        <text x={170} y={54} fill="#94a3b8" fontSize={7} textAnchor="middle">POI Identification</text>

        <rect x={230} y={10} width={100} height={55} rx={6} fill="#f59e0b10" stroke="#f59e0b" strokeWidth={1} />
        <text x={280} y={28} fill="#f59e0b" fontSize={9} fontWeight="bold" textAnchor="middle">LTF (5m/15m)</text>
        <text x={280} y={42} fill="#94a3b8" fontSize={7} textAnchor="middle">Entry Trigger</text>
        <text x={280} y={54} fill="#94a3b8" fontSize={7} textAnchor="middle">Risk Placement</text>

        <line x1={110} y1={37} x2={120} y2={37} stroke="#94a3b8" strokeWidth={1} markerEnd="url(#arrowMTF)" />
        <line x1={220} y1={37} x2={230} y2={37} stroke="#94a3b8" strokeWidth={1} markerEnd="url(#arrowMTF)" />
        <defs><marker id="arrowMTF" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" /></marker></defs>

        <rect x={10} y={80} width={320} height={70} rx={6} fill="hsl(var(--muted))" opacity={0.3} />
        <text x={20} y={97} fill="#94a3b8" fontSize={8} fontWeight="bold">Rule: Only take LTF entries that align with HTF bias</text>
        <text x={20} y={112} fill="#94a3b8" fontSize={7}>1. HTF bullish trend = Only look for longs on LTF</text>
        <text x={20} y={125} fill="#94a3b8" fontSize={7}>2. MTF identifies POI (order block, FVG) = Zone to watch</text>
        <text x={20} y={138} fill="#94a3b8" fontSize={7}>3. LTF CHoCH/BOS at POI = Entry confirmation</text>
      </svg>
    </div>
  );
}

export function EntryModelDiagram() {
  const candles: SVGCandleData[] = [
    { o: 108, h: 109, l: 106, c: 107 },
    { o: 107, h: 108, l: 105, c: 106 },
    { o: 106, h: 107, l: 104, c: 105 },
    { o: 105, h: 106, l: 103, c: 104 },
    { o: 104, h: 105, l: 102.5, c: 103 },
    { o: 103, h: 103.5, l: 101, c: 101.5 },
    { o: 101.5, h: 102, l: 100, c: 100.5 },
    { o: 100.5, h: 102, l: 100, c: 101.5 },
    { o: 101.5, h: 103, l: 101, c: 102.5 },
    { o: 102.5, h: 104, l: 102, c: 103.5 },
    { o: 103.5, h: 105, l: 103, c: 104.5 },
    { o: 104.5, h: 107, l: 104, c: 106 },
  ];
  const W = 340;
  const H = 200;

  return (
    <div className="p-6 bg-muted/30 rounded-xl border border-border">
      <h4 className="text-sm font-bold text-foreground mb-1">Optimal Trade Entry (OTE)</h4>
      <p className="text-xs text-muted-foreground mb-4">Fibonacci retracement entry at the 0.618-0.786 zone during a pullback</p>
      <ChartFrame candles={candles} width={W} height={H} annotations={(minP, maxP) => {
        const swingH = priceToY(109, minP, maxP, H);
        const swingL = priceToY(100, minP, maxP, H);
        const fib618 = priceToY(100 + (109 - 100) * 0.382, minP, maxP, H);
        const fib786 = priceToY(100 + (109 - 100) * 0.214, minP, maxP, H);
        const fib5 = priceToY(100 + (109 - 100) * 0.5, minP, maxP, H);
        return (
          <g>
            <line x1={W - 80} y1={swingH} x2={W - 10} y2={swingH} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={W - 35} y={swingH - 3} fill="#94a3b8" fontSize={7}>1.0</text>
            <line x1={W - 80} y1={swingL} x2={W - 10} y2={swingL} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={W - 30} y={swingL + 10} fill="#94a3b8" fontSize={7}>0.0</text>
            <line x1={W - 80} y1={fib5} x2={W - 10} y2={fib5} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={W - 35} y={fib5 - 3} fill="#94a3b8" fontSize={7}>0.5</text>
            <rect x={10 + 5 * 16} y={fib618} width={W - 20 - 5 * 16} height={fib786 - fib618} fill="#10b981" opacity={0.12} stroke="#10b981" strokeWidth={0.5} strokeDasharray="3,2" rx={2} />
            <text x={W - 75} y={fib618 - 3} fill="#10b981" fontSize={7} fontWeight="bold">0.618</text>
            <text x={W - 75} y={fib786 + 10} fill="#10b981" fontSize={7} fontWeight="bold">0.786</text>
            <text x={10 + 6 * 16} y={(fib618 + fib786) / 2 + 3} fill="#10b981" fontSize={8} fontWeight="bold">OTE Zone</text>
          </g>
        );
      }} />
      <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
        The Optimal Trade Entry zone (0.618-0.786 Fibonacci) offers the best risk-to-reward during pullbacks within a trend.
      </p>
    </div>
  );
}

export const DIAGRAM_TYPES = {
  "market-structure": MarketStructureDiagram,
  "order-block": OrderBlockDiagram,
  "fvg": FVGDiagram,
  "liquidity-sweep": LiquiditySweepDiagram,
  "bos-choch": BOSCHoCHDiagram,
  "candlestick-patterns": CandlestickPatternsDiagram,
  "sessions": SessionsDiagram,
  "risk-reward": RiskRewardDiagram,
  "breaker-block": BreakerBlockDiagram,
  "inducement": InducementDiagram,
  "multi-timeframe": MultiTimeframeDiagram,
  "entry-model": EntryModelDiagram,
} as const;

export type DiagramType = keyof typeof DIAGRAM_TYPES;
