import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { Card } from '@/components/ui/card';

interface TradingChartProps {
  symbol?: string;
}

export function TradingChart({ symbol = 'BTC/USD' }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | any>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | any>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(75, 85, 99, 0.2)' },
        horzLines: { color: 'rgba(75, 85, 99, 0.2)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candlestickSeries as any;

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      title: 'SMA 20',
    });
    smaSeriesRef.current = smaSeries as any;

    // Generate mock data
    const generateData = () => {
      const data = [];
      let time = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      let lastClose = 50000;

      for (let i = 0; i < 100; i++) {
        const open = lastClose + (Math.random() - 0.5) * 1000;
        const close = open + (Math.random() - 0.5) * 1000;
        const high = Math.max(open, close) + Math.random() * 500;
        const low = Math.min(open, close) - Math.random() * 500;

        data.push({
          time: (time.getTime() / 1000) as any,
          open,
          high,
          low,
          close,
        });

        lastClose = close;
        time = new Date(time.getTime() + 24 * 60 * 60 * 1000);
      }
      return data;
    };

    const initialData = generateData();
    candlestickSeries.setData(initialData);

    // Calculate SMA
    const smaData = initialData.map((d, i) => {
      if (i < 20) return null;
      const slice = initialData.slice(i - 20, i);
      const sum = slice.reduce((a, b) => a + b.close, 0);
      return {
        time: d.time,
        value: sum / 20,
      };
    }).filter(d => d !== null);

    smaSeries.setData(smaData as any);

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return (
    <Card className="p-4 bg-background/50 backdrop-blur-sm border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground" data-testid="text-chart-symbol">{symbol} Real-Time Analysis</h3>
        <div className="flex gap-2">
          <span className="text-xs text-blue-400">SMA 20</span>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" data-testid="container-trading-chart" />
    </Card>
  );
}
