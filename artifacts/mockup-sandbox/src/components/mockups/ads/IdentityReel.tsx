import React from 'react';

export default function IdentityReel() {
  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col items-center relative" style={{ backgroundColor: '#0A0F1E', fontFamily: '"Inter", sans-serif' }}>
      {/* Top 65% Zone */}
      <div className="w-full h-[65%] flex flex-col items-center pt-[10vh] px-[5vw] text-center z-10 relative">
        <h1 className="text-[#F9FAFB] font-bold leading-tight" style={{ fontSize: '6vw' }}>
          TRADERS WHO STAY FUNDED...
        </h1>
        <h2 className="text-[#00D9A3] font-black leading-tight mt-[1vh]" style={{ fontSize: '7vw' }}>
          DON'T USE WILLPOWER.
        </h2>

        {/* Prop Firm Gauge Card */}
        <div className="mt-[5vh] w-[85vw] border rounded-xl p-[4vw] shadow-lg flex flex-col gap-[2vh] relative" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
          {/* Badge */}
          <div className="absolute top-[2vw] right-[2vw] bg-[#00D9A3]/20 text-[#00D9A3] px-[2vw] py-[0.5vh] rounded-md font-bold text-[2.5vw] flex items-center gap-[1vw]">
            FUNDED ✓
          </div>
          
          <div className="flex flex-col text-left mt-[3vh]">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '2.5vw' }}>DAILY DRAWDOWN</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '3.5vw' }}>+0.8% / 5.0% limit</span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '2.5vw' }}>TOTAL DRAWDOWN</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '3.5vw' }}>+3.2% / 10.0% limit</span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '2.5vw' }}>PROFIT TARGET</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '3.5vw' }}>$847 / $1,000</span>
          </div>
        </div>

        <div className="mt-[4vh]">
          <p className="text-[#F9FAFB] font-semibold" style={{ fontSize: '3vw' }}>They use a system.</p>
          <p className="text-[#6B7280] mt-[1vh]" style={{ fontSize: '2.5vw' }}>Tradify enforces every rule. Automatically.</p>
        </div>

        <button className="mt-[5vh] font-bold rounded-lg px-[8vw] py-[2vh] uppercase transition-transform active:scale-95 shadow-md" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '3vw' }}>
          JOIN FREE
        </button>
      </div>

      {/* Logo */}
      <div className="absolute bottom-[3vh] right-[4vw] font-bold" style={{ color: '#00D9A3', fontSize: '3vw' }}>
        TRADIFY
      </div>
    </div>
  );
}
