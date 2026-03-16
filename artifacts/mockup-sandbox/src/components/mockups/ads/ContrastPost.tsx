import React from 'react';

export const ContrastPost = () => {
  return (
    <div style={{ backgroundColor: '#0A0F1E', fontFamily: 'Inter, sans-serif' }} className="w-screen h-screen overflow-hidden flex flex-col relative aspect-square">
      {/* Top Strip */}
      <div className="h-[6vh] w-full flex items-center justify-center font-bold tracking-widest uppercase" style={{ color: '#6B7280', fontSize: '2vw' }}>
        TRADIFYAPP.COM
      </div>

      {/* Main Area */}
      <div className="flex-1 flex w-full relative">
        {/* Left MT5 */}
        <div className="w-1/2 h-full flex flex-col justify-center items-center p-8 border-l-4" style={{ backgroundColor: '#111827', borderColor: '#EF4444' }}>
          <div className="w-full max-w-[80%]">
            <h2 className="font-bold mb-2 uppercase" style={{ color: '#6B7280', fontSize: '4vw', fontFamily: '"JetBrains Mono", monospace' }}>MT5</h2>
            <p className="mb-10 font-medium" style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>Shows you what happened</p>
            
            <div className="flex flex-col gap-4 w-full" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '2.5vw' }}>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: '#1F2937' }}>
                <span style={{ color: '#F9FAFB' }}>EURUSD</span>
                <span style={{ color: '#EF4444' }}>-$142</span>
              </div>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: '#1F2937' }}>
                <span style={{ color: '#F9FAFB' }}>XAUUSD</span>
                <span style={{ color: '#EF4444' }}>-$380</span>
              </div>
              <div className="flex justify-between border-b pb-2" style={{ borderColor: '#1F2937' }}>
                <span style={{ color: '#F9FAFB' }}>EURUSD</span>
                <span style={{ color: '#EF4444' }}>-$560</span>
              </div>
              
              <div className="flex justify-between mt-4 font-bold" style={{ fontSize: '3vw' }}>
                <span style={{ color: '#6B7280' }}>Total P&L:</span>
                <span style={{ color: '#EF4444' }}>-$1,082</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider & VS Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center h-full w-0">
          <div className="w-[1px] h-full" style={{ backgroundColor: '#1F2937' }}></div>
          <div className="absolute rounded-full flex items-center justify-center font-bold shadow-xl" style={{ backgroundColor: '#1F2937', color: '#6B7280', width: '5vw', height: '5vw', fontSize: '2vw' }}>
            VS
          </div>
        </div>

        {/* Right Tradify */}
        <div className="w-1/2 h-full flex flex-col justify-center items-center p-8 border-l-4" style={{ backgroundColor: '#0F2A20', borderColor: '#00D9A3' }}>
          <div className="w-full max-w-[80%] relative h-full flex flex-col justify-center">
            <h2 className="font-bold mb-2 uppercase" style={{ color: '#00D9A3', fontSize: '4vw' }}>TRADIFY</h2>
            <p className="mb-10 font-medium" style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>Stops it happening</p>
            
            <div className="flex flex-col gap-4 w-full mb-10" style={{ fontSize: '2.5vw', color: '#F9FAFB' }}>
              <div className="flex items-center gap-3">
                <span style={{ color: '#00D9A3', fontSize: '3vw' }}>✓</span> Daily Loss Limit OK
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: '#00D9A3', fontSize: '3vw' }}>✓</span> News Window OK
              </div>
              <div className="flex items-center gap-3">
                <span style={{ color: '#00D9A3', fontSize: '3vw' }}>✓</span> Max Pairs OK
              </div>
              <div className="flex items-center gap-3 opacity-50">
                <span style={{ color: '#EF4444', fontSize: '3vw' }}>×</span> Lot Size Exceeded
              </div>
            </div>

            <div className="mt-auto pt-4 flex justify-start">
              <div className="px-6 py-2 font-bold rounded-md shadow-lg uppercase" style={{ backgroundColor: '#EF4444', color: '#0A0F1E', fontSize: '2.5vw' }}>
                [TRADE BLOCKED]
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Strip */}
      <div className="h-[8vh] w-full flex items-center justify-center font-bold uppercase tracking-wider shadow-2xl z-10" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '3vw' }}>
        ADD THE DISCIPLINE LAYER — FREE
      </div>
    </div>
  );
};
