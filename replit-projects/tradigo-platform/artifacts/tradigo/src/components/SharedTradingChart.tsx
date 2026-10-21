import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router';
import { ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Cell } from 'recharts';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function SharedTradingChart() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChartData() {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/chart`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        
        // Mock data fetching for now as the server route is basic
        const mockCandles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
            timestamp: Date.now() - (50 - i) * 60000,
            open: 100 + Math.random() * 5,
            high: 110 + Math.random() * 5,
            low: 90 + Math.random() * 5,
            close: 100 + Math.random() * 5,
        }));
        setCandles(mockCandles);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load chart data', err);
        setLoading(false);
      }
    }
    fetchChartData();
  }, [sessionId]);

  if (loading) return <div>Loading chart...</div>;

  return (
    <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-bold mb-4">Shared Trading Chart (Demo)</h2>
        <ComposedChart width={600} height={300} data={candles}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            {/* Simple candlestick approximation using bar chart */}
            <Bar dataKey="close" fill="#8884d8">
              {candles.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? '#82ca9d' : '#8884d8'} />
              ))}
            </Bar>
        </ComposedChart>
    </div>
  );
}
