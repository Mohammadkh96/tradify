import React, { useState } from 'react';
import { DollarSign, Sliders, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PriceRangeFilterProps {
  minRate: number;
  maxRate: number;
  rateType: 'hourly' | 'perMinute';
  onRateChange: (min: number, max: number, type: 'hourly' | 'perMinute') => void;
  className?: string;
}

export const PriceRangeFilter: React.FC<PriceRangeFilterProps> = ({
  minRate,
  maxRate,
  rateType,
  onRateChange,
  className,
}) => {
  const [localMin, setLocalMin] = useState<number>(minRate);
  const [localMax, setLocalMax] = useState<number>(maxRate);
  const [type, setType] = useState<'hourly' | 'perMinute'>(rateType);

  const limits = type === 'hourly' ? { min: 50, max: 500, step: 10 } : { min: 1, max: 15, step: 0.5 };

  const handleMinChange = (val: number) => {
    const newMin = Math.min(val, localMax - (type === 'hourly' ? 10 : 0.5));
    setLocalMin(newMin);
    onRateChange(newMin, localMax, type);
  };

  const handleMaxChange = (val: number) => {
    const newMax = Math.max(val, localMin + (type === 'hourly' ? 10 : 0.5));
    setLocalMax(newMax);
    onRateChange(localMin, newMax, type);
  };

  const handleTypeSwitch = (newType: 'hourly' | 'perMinute') => {
    setType(newType);
    const newLimits = newType === 'hourly' ? { min: 100, max: 350 } : { min: 2, max: 8 };
    setLocalMin(newLimits.min);
    setLocalMax(newLimits.max);
    onRateChange(newLimits.min, newLimits.max, newType);
  };

  const handleReset = () => {
    const defaultLimits = type === 'hourly' ? { min: 50, max: 500 } : { min: 1, max: 15 };
    setLocalMin(defaultLimits.min);
    setLocalMax(defaultLimits.max);
    onRateChange(defaultLimits.min, defaultLimits.max, type);
  };

  return (
    <div className={cn("bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl text-slate-100 space-y-4 backdrop-blur-md", className)}>
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight text-slate-100">Rate & Budget Filter</h4>
            <p className="text-[11px] text-slate-400">Filter coach discovery by price range</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleTypeSwitch('hourly')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                type === 'hourly' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Hourly ($/hr)
            </button>
            <button
              onClick={() => handleTypeSwitch('perMinute')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                type === 'perMinute' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Per Min ($/min)
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Selected Budget Range:</span>
          <span className="font-black text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/30">
            {type === 'hourly' ? `$${localMin}/hr — $${localMax}/hr` : `$${localMin.toFixed(2)}/min — $${localMax.toFixed(2)}/min`}
          </span>
        </div>

        {/* Dual Range Sliders */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Minimum Rate</span>
              <span className="text-slate-200 font-semibold">
                {type === 'hourly' ? `$${localMin}/hr` : `$${localMin.toFixed(2)}/min`}
              </span>
            </div>
            <input
              type="range"
              min={limits.min}
              max={limits.max}
              step={limits.step}
              value={localMin}
              onChange={(e) => handleMinChange(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer bg-slate-950 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Maximum Rate</span>
              <span className="text-slate-200 font-semibold">
                {type === 'hourly' ? `$${localMax}/hr` : `$${localMax.toFixed(2)}/min`}
              </span>
            </div>
            <input
              type="range"
              min={limits.min}
              max={limits.max}
              step={limits.step}
              value={localMax}
              onChange={(e) => handleMaxChange(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer bg-slate-950 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
