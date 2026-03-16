import React from 'react';

export default function IdentityPost() {
  return (
    <div className="w-screen h-screen overflow-hidden flex" style={{ backgroundColor: '#0A0F1E', fontFamily: '"Inter", sans-serif' }}>
      
      {/* Left Zone - 55% */}
      <div className="w-[55%] h-full flex flex-col justify-center px-[6vw] relative">
        {/* Logo */}
        <div className="absolute top-[4vw] left-[6vw] font-bold" style={{ color: '#00D9A3', fontSize: '2vw' }}>
          TRADIFY
        </div>

        <div>
          <h1 className="text-[#F9FAFB] font-bold leading-none" style={{ fontSize: '5vw' }}>
            SYSTEMS BEAT
          </h1>
          <h2 className="text-[#00D9A3] font-black leading-none mt-[1vh]" style={{ fontSize: '5.5vw' }}>
            WILLPOWER.
          </h2>
          
          <div className="w-[10vw] h-[2px] mt-[4vh] mb-[4vh]" style={{ backgroundColor: '#1F2937' }}></div>

          <p className="text-[#6B7280] font-medium italic mb-[6vh]" style={{ fontSize: '2vw' }}>
            "Funded traders remove the decision."
          </p>

          <button className="font-bold rounded-lg px-[4vw] py-[1.5vh] uppercase transition-transform hover:scale-105" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '1.8vw', width: 'fit-content' }}>
            JOIN FREE
          </button>
        </div>
      </div>

      {/* Right Zone - 45% */}
      <div className="w-[45%] h-full flex flex-col justify-center items-center px-[4vw] border-l" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
        
        {/* Prop Firm Gauge */}
        <div className="w-full border rounded-xl p-[2.5vw] shadow-2xl relative flex flex-col gap-[1.5vh]" style={{ backgroundColor: '#0A0F1E', borderColor: '#1F2937' }}>
          {/* Badge */}
          <div className="absolute top-[1.5vw] right-[1.5vw] bg-[#00D9A3]/20 text-[#00D9A3] px-[1vw] py-[0.5vh] rounded-md font-bold text-[1vw] flex items-center gap-[0.5vw]">
            FUNDED ✓
          </div>
          
          <div className="flex flex-col text-left mt-[2vh]">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '1.2vw' }}>DAILY DRAWDOWN</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>+0.8% / 5.0% limit</span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '1.2vw' }}>TOTAL DRAWDOWN</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>+3.2% / 10.0% limit</span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '1.2vw' }}>PROFIT TARGET</span>
            <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>$847 / $1,000</span>
          </div>
        </div>

        {/* Analytics Card */}
        <div className="w-full border rounded-xl p-[2vw] mt-[3vh] shadow-xl" style={{ backgroundColor: '#0A0F1E', borderColor: '#1F2937' }}>
          <div className="grid grid-cols-2 gap-[2vh]">
            <div>
              <div className="text-[#6B7280] uppercase tracking-wider" style={{ fontSize: '1vw' }}>Win Rate</div>
              <div className="text-[#F9FAFB]" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>67.3%</div>
            </div>
            <div>
              <div className="text-[#6B7280] uppercase tracking-wider" style={{ fontSize: '1vw' }}>Profit Factor</div>
              <div className="text-[#F9FAFB]" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>2.1</div>
            </div>
            <div>
              <div className="text-[#6B7280] uppercase tracking-wider" style={{ fontSize: '1vw' }}>Avg R:R</div>
              <div className="text-[#F9FAFB]" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>1:2.4</div>
            </div>
            <div>
              <div className="text-[#6B7280] uppercase tracking-wider" style={{ fontSize: '1vw' }}>Streak</div>
              <div className="text-[#F9FAFB]" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '1.8vw' }}>5W 0L</div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
