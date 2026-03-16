import React, { useState } from 'react';

export const ContrastCarousel = () => {
  const [slide, setSlide] = useState(0);

  const nextSlide = () => setSlide((s) => (s + 1) % 5);
  const prevSlide = () => setSlide((s) => (s - 1 + 5) % 5);

  return (
    <div style={{ backgroundColor: '#0A0F1E', fontFamily: 'Inter, sans-serif' }} className="w-screen h-screen overflow-hidden flex flex-col relative aspect-square text-white">
      {/* Logo */}
      <div className="absolute top-6 left-6 font-bold tracking-tighter z-20" style={{ color: '#00D9A3', fontSize: '3vw' }}>
        TRADIFY
      </div>

      {/* Slides Container */}
      <div className="flex-1 w-full h-full flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${slide * 100}vw)` }}>
        
        {/* Slide 1 (Hook) */}
        <div className="w-screen h-full flex-shrink-0 flex flex-col justify-center items-center p-10 text-center relative">
          <h1 className="font-bold uppercase leading-tight mb-6 max-w-[80vw]" style={{ color: '#F9FAFB', fontSize: '5vw' }}>
            WHAT MT5 CAN'T DO FOR YOUR PROP FIRM CHALLENGE
          </h1>
          <p className="font-semibold" style={{ color: '#00D9A3', fontSize: '3vw' }}>
            And what Tradify can.
          </p>
        </div>

        {/* Slide 2: Records trades */}
        <div className="w-screen h-full flex-shrink-0 flex flex-col justify-center items-center p-10">
          <h2 className="font-bold mb-10" style={{ color: '#F9FAFB', fontSize: '4vw' }}>MT5 records your trades.</h2>
          <div className="w-[80vw] p-6 rounded-xl border flex flex-col gap-4 shadow-xl mb-10" style={{ backgroundColor: '#111827', borderColor: '#1F2937', fontFamily: '"JetBrains Mono", monospace', fontSize: '2.5vw' }}>
            <div className="flex justify-between"><span style={{ color: '#6B7280' }}>10:45</span><span>EURUSD SELL 2.0</span><span style={{ color: '#EF4444' }}>-$450</span></div>
            <div className="flex justify-between"><span style={{ color: '#6B7280' }}>11:12</span><span>US30 BUY 5.0</span><span style={{ color: '#EF4444' }}>-$1200</span></div>
            <div className="flex justify-between"><span style={{ color: '#6B7280' }}>11:15</span><span>US30 BUY 10.0</span><span style={{ color: '#EF4444' }}>-$2800</span></div>
          </div>
          <p className="text-center max-w-[80vw] font-medium" style={{ color: '#F9FAFB', fontSize: '3vw' }}>
            But it won't stop you taking the next bad one.
          </p>
        </div>

        {/* Slide 3: Analytics */}
        <div className="w-screen h-full flex-shrink-0 flex flex-col justify-center items-center p-10">
          <h2 className="font-bold mb-10" style={{ color: '#F9FAFB', fontSize: '4vw' }}>MT5 shows your P&L.</h2>
          <div className="w-[80vw] p-8 rounded-xl border flex flex-col gap-6 shadow-xl mb-10" style={{ backgroundColor: '#111827', borderColor: '#1F2937', fontFamily: '"JetBrains Mono", monospace' }}>
            <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: '#1F2937' }}>
              <span style={{ color: '#6B7280', fontSize: '2.5vw' }}>Win Rate</span>
              <span style={{ color: '#EF4444', fontSize: '3.5vw', fontWeight: 'bold' }}>32.4%</span>
            </div>
            <div className="flex justify-between items-center border-b pb-4" style={{ borderColor: '#1F2937' }}>
              <span style={{ color: '#6B7280', fontSize: '2.5vw' }}>Profit Factor</span>
              <span style={{ color: '#EF4444', fontSize: '3.5vw', fontWeight: 'bold' }}>0.4</span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{ color: '#6B7280', fontSize: '2.5vw' }}>Streak</span>
              <span style={{ color: '#EF4444', fontSize: '3.5vw', fontWeight: 'bold' }}>0W 5L</span>
            </div>
          </div>
          <p className="text-center max-w-[80vw] font-medium" style={{ color: '#F9FAFB', fontSize: '3vw' }}>
            But it won't enforce your risk rules.
          </p>
        </div>

        {/* Slide 4: Tradify blocks */}
        <div className="w-screen h-full flex-shrink-0 flex flex-col justify-center items-center p-10">
          <h2 className="font-bold mb-10 text-center max-w-[90vw] leading-tight" style={{ color: '#F9FAFB', fontSize: '4vw' }}>
            Tradify blocks trades that break your rules.
          </h2>
          <div className="w-[80vw] p-8 rounded-xl border shadow-2xl mb-10 relative" style={{ backgroundColor: '#0F2A20', borderColor: '#00D9A3' }}>
            <div className="flex flex-col gap-5" style={{ fontSize: '3vw' }}>
              <div className="flex items-center gap-3"><span style={{ color: '#00D9A3' }}>✓</span> Daily Drawdown OK</div>
              <div className="flex items-center gap-3"><span style={{ color: '#00D9A3' }}>✓</span> Session OK</div>
              <div className="flex items-center gap-3 opacity-60"><span style={{ color: '#EF4444' }}>×</span> Max Trades Exceeded</div>
            </div>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-2 font-bold rounded-lg shadow-2xl" style={{ backgroundColor: '#EF4444', color: '#0A0F1E', fontSize: '3vw' }}>
              [TRADE BLOCKED]
            </div>
          </div>
          <p className="text-center max-w-[80vw] font-bold mt-4" style={{ color: '#00D9A3', fontSize: '3.5vw' }}>
            Before they hit your account.
          </p>
        </div>

        {/* Slide 5: CTA */}
        <div className="w-screen h-full flex-shrink-0 flex flex-col justify-center items-center p-10 text-center">
          <h1 className="font-bold uppercase leading-tight mb-8" style={{ color: '#F9FAFB', fontSize: '4.5vw' }}>
            MT5 + TRADIFY =<br/>NEVER BREACH AGAIN.
          </h1>
          <p className="mb-12 font-medium" style={{ color: '#6B7280', fontSize: '3vw' }}>
            Free on tradifyapp.com
          </p>
          <button className="px-10 py-5 font-bold uppercase rounded-lg shadow-[0_0_30px_rgba(0,217,163,0.3)] tracking-wide" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '4vw' }}>
            GET TRADIFY FREE
          </button>
        </div>

      </div>

      {/* Navigation Overlays */}
      <div className="absolute inset-y-0 left-0 w-1/4 z-10 cursor-pointer" onClick={prevSlide} />
      <div className="absolute inset-y-0 right-0 w-1/4 z-10 cursor-pointer" onClick={nextSlide} />

      {/* Dots */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3 z-20">
        {[0, 1, 2, 3, 4].map((i) => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full transition-colors ${slide === i ? 'bg-[#00D9A3]' : 'bg-[#1F2937]'}`}
          />
        ))}
      </div>
    </div>
  );
};
