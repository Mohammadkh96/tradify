import React, { useState } from 'react';

export default function IdentityCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => setCurrentSlide((p) => (p + 1) % 5);

  return (
    <div 
      className="w-screen h-screen overflow-hidden flex flex-col justify-center items-center relative cursor-pointer" 
      style={{ backgroundColor: '#0A0F1E', fontFamily: '"Inter", sans-serif' }}
      onClick={nextSlide}
    >
      {/* Logo */}
      <div className="absolute top-[4vw] left-[4vw] font-bold z-20" style={{ color: '#00D9A3', fontSize: '2.5vw' }}>
        TRADIFY
      </div>

      {/* Slides Container */}
      <div className="w-full h-full flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}vw)` }}>
        
        {/* Slide 1 */}
        <div className="w-screen h-screen flex-shrink-0 flex items-center justify-center px-[8vw] text-center">
          <h1 className="text-[#F9FAFB] font-bold leading-tight" style={{ fontSize: '5vw' }}>
            WHAT DO TRADERS WHO STAY FUNDED HAVE IN COMMON?
          </h1>
        </div>

        {/* Slide 2 */}
        <div className="w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center px-[10vw] text-center relative">
          <div className="border-l-[1vw] pl-[4vw] py-[2vh] text-left w-full max-w-[70vw]" style={{ borderColor: '#00D9A3' }}>
            <h1 className="text-[#F9FAFB] font-bold leading-tight" style={{ fontSize: '5vw' }}>
              It's not a better strategy.
            </h1>
            <p className="text-[#6B7280] font-medium mt-[2vh]" style={{ fontSize: '3vw' }}>
              Strategy is the easy part.
            </p>
          </div>
        </div>

        {/* Slide 3 */}
        <div className="w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center px-[10vw] text-center relative">
          <div className="border-l-[1vw] pl-[4vw] py-[2vh] text-left w-full max-w-[70vw]" style={{ borderColor: '#EF4444' }}>
            <h1 className="text-[#F9FAFB] font-bold leading-tight" style={{ fontSize: '5vw' }}>
              It's not more screen time.
            </h1>
            <p className="text-[#6B7280] font-medium mt-[2vh]" style={{ fontSize: '3vw' }}>
              Most blown accounts happen from 1 impulsive session.
            </p>
          </div>
        </div>

        {/* Slide 4 */}
        <div className="w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center px-[10vw] text-center relative">
          <h1 className="text-[#F9FAFB] font-bold leading-tight mb-[6vh]" style={{ fontSize: '4.5vw' }}>
            It's a system that removes decisions.
          </h1>

          {/* Prop Firm Gauge Mockup */}
          <div className="w-[60vw] border rounded-xl p-[3vw] shadow-2xl relative flex flex-col gap-[2vh] text-left" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
            <div className="absolute top-[2vw] right-[2vw] bg-[#00D9A3]/20 text-[#00D9A3] px-[1.5vw] py-[0.5vh] rounded-md font-bold text-[1.5vw] flex items-center gap-[0.5vw]">
              FUNDED ✓
            </div>
            
            <div className="flex flex-col mt-[2vh]">
              <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '1.5vw' }}>DAILY DRAWDOWN</span>
              <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '2.5vw' }}>+0.8% / 5.0% limit</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#6B7280] font-semibold tracking-wider" style={{ fontSize: '1.5vw' }}>TOTAL DRAWDOWN</span>
              <span className="text-[#00D9A3] font-medium" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '2.5vw' }}>+3.2% / 10.0% limit</span>
            </div>
          </div>

          <p className="text-[#00D9A3] font-medium mt-[5vh]" style={{ fontSize: '2.5vw' }}>
            Tradify does this automatically.
          </p>
        </div>

        {/* Slide 5 */}
        <div className="w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center px-[8vw] text-center">
          <h1 className="text-[#F9FAFB] font-black leading-tight mb-[2vh]" style={{ fontSize: '4.5vw' }}>
            JOIN THE TRADERS WHO STAY FUNDED.
          </h1>
          <p className="text-[#6B7280] font-medium mb-[6vh]" style={{ fontSize: '2.5vw' }}>
            Start free at tradifyapp.com
          </p>
          <button className="font-bold rounded-lg px-[6vw] py-[2vh] uppercase transition-transform hover:scale-105" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '2.5vw' }}>
            JOIN FREE
          </button>
        </div>

      </div>

      {/* Dots Indicator */}
      <div className="absolute bottom-[4vw] flex gap-[1vw] z-20">
        {[0, 1, 2, 3, 4].map(idx => (
          <div 
            key={idx} 
            className={`h-[1vw] rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-[3vw] bg-[#00D9A3]' : 'w-[1vw] bg-[#1F2937]'}`}
            onClick={(e) => { e.stopPropagation(); setCurrentSlide(idx); }}
          ></div>
        ))}
      </div>
    </div>
  );
}
