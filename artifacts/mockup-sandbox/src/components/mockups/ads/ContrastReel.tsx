import React from 'react';

export const ContrastReel = () => {
  return (
    <div style={{ backgroundColor: '#0A0F1E', fontFamily: 'Inter, sans-serif' }} className="w-screen h-screen overflow-hidden flex flex-col items-center justify-start relative">
      {/* Logo */}
      <div className="absolute top-6 left-6 font-bold tracking-tighter" style={{ color: '#00D9A3', fontSize: '3vw' }}>
        TRADIFY
      </div>
      
      {/* Top Text */}
      <div className="mt-[15vh] flex flex-col items-center text-center px-4 w-full">
        <h1 className="font-bold uppercase leading-none" style={{ color: '#F9FAFB', fontSize: '6vw' }}>
          MT5 ALONE WON'T
        </h1>
        <h2 className="font-bold uppercase leading-none mt-2" style={{ color: '#EF4444', fontSize: '6.5vw' }}>
          SAVE YOUR ACCOUNT.
        </h2>
      </div>

      {/* Middle Split Card */}
      <div className="mt-10 w-[90vw] h-[40vh] flex border rounded-xl overflow-hidden shadow-2xl" style={{ borderColor: '#1F2937' }}>
        {/* MT5 Side */}
        <div className="w-1/2 h-full flex flex-col p-4 relative" style={{ backgroundColor: '#111827' }}>
          <div className="font-bold uppercase mb-4" style={{ color: '#6B7280', fontSize: '3vw' }}>MT5</div>
          <div className="flex-1 flex flex-col gap-3" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            <div className="flex justify-between items-center" style={{ fontSize: '2.2vw' }}>
              <span style={{ color: '#F9FAFB' }}>EURUSD BUY 0.5</span>
              <span style={{ color: '#EF4444' }}>-$142</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: '2.2vw' }}>
              <span style={{ color: '#F9FAFB' }}>XAUUSD BUY 1.0</span>
              <span style={{ color: '#EF4444' }}>-$380</span>
            </div>
            <div className="flex justify-between items-center" style={{ fontSize: '2.2vw' }}>
              <span style={{ color: '#F9FAFB' }}>EURUSD BUY 1.0</span>
              <span style={{ color: '#EF4444' }}>-$560</span>
            </div>
          </div>
          <div className="absolute bottom-4 left-4" style={{ color: '#6B7280', fontSize: '2.2vw' }}>
            Records what happened
          </div>
        </div>

        {/* Divider */}
        <div className="w-[1px] h-full" style={{ backgroundColor: '#1F2937' }} />

        {/* Tradify Side */}
        <div className="w-1/2 h-full flex flex-col p-4 relative" style={{ backgroundColor: '#0F2A20' }}>
          <div className="font-bold uppercase mb-4" style={{ color: '#00D9A3', fontSize: '3vw' }}>TRADIFY</div>
          <div className="flex-1 flex flex-col gap-3" style={{ fontSize: '2.2vw', color: '#F9FAFB' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: '#00D9A3' }}>✓</span> Max Loss Ok
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: '#00D9A3' }}>✓</span> Time Ok
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: '#EF4444' }}>×</span> Overleveraged
            </div>
          </div>
          <div className="absolute bottom-12 w-full left-0 flex justify-center">
            <div className="px-3 py-1 font-bold rounded text-center" style={{ backgroundColor: '#EF4444', color: '#0A0F1E', fontSize: '2.2vw' }}>
              [TRADE BLOCKED]
            </div>
          </div>
          <div className="absolute bottom-4 left-4 font-bold" style={{ color: '#00D9A3', fontSize: '2.2vw' }}>
            Stops it happening
          </div>
        </div>
      </div>

      {/* Text below card */}
      <div className="mt-8 font-medium" style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>
        Add the discipline layer.
      </div>

      {/* CTA */}
      <button className="mt-10 px-8 py-4 font-bold uppercase rounded-lg shadow-lg tracking-wide" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '4vw' }}>
        FREE ON TRADIFYAPP.COM
      </button>

    </div>
  );
};
