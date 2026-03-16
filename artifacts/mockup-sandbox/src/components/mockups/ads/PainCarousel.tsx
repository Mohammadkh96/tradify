import React, { useState } from 'react';

export function PainCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, 4));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  return (
    <div 
      className="w-screen h-screen overflow-hidden relative flex items-center justify-center"
      style={{ backgroundColor: '#0A0F1E', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Logo Component */}
      <div className="absolute top-[4vh] left-[4vw] flex flex-col z-10">
        <span className="font-bold tracking-tight" style={{ color: '#00D9A3', fontSize: '3vw' }}>TRADIFY</span>
        <span style={{ color: '#6B7280', fontSize: '1.5vw' }}>Your Rules. Enforced.</span>
      </div>

      {/* Slides Container */}
      <div className="w-full h-full relative">
        
        {/* SLIDE 1 */}
        {currentSlide === 0 && (
          <div className="w-full h-full flex items-center justify-center p-[8vw]">
            <h1 className="font-bold leading-tight text-center" style={{ color: '#F9FAFB', fontSize: '6vw' }}>
              WHY TRADERS WITH GOOD STRATEGIES STILL <span style={{ color: '#00D9A3' }}>BLOW ACCOUNTS</span>
            </h1>
          </div>
        )}

        {/* SLIDE 2 */}
        {currentSlide === 1 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-[8vw] gap-[5vh]">
            <h2 className="font-bold text-center" style={{ color: '#F9FAFB', fontSize: '5vw' }}>
              #1: Revenge trading after a loss
            </h2>
            <div className="rounded-2xl p-[6vw] flex flex-col items-center gap-[3vh] border" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
              <div className="flex items-center justify-center rounded-full w-[12vw] h-[12vw]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB' }}>
                <svg className="w-[8vw] h-[8vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <p className="font-bold text-center leading-tight" style={{ color: '#EF4444', fontSize: '4.5vw' }}>
                43% of blown challenges happen in a single session
              </p>
            </div>
          </div>
        )}

        {/* SLIDE 3 */}
        {currentSlide === 2 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-[6vw] gap-[4vh]">
            <h2 className="font-bold text-center leading-tight" style={{ color: '#F9FAFB', fontSize: '4.5vw' }}>
              #2: Breaking rules under pressure
            </h2>
            <div className="w-full max-w-[70vw] rounded-xl border p-[4vw] shadow-2xl flex flex-col gap-[2vh]" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
              <h2 className="font-bold text-center tracking-wider" style={{ color: '#6B7280', fontSize: '2.5vw' }}>PRE-TRADE CHECKLIST</h2>
              <div className="flex flex-col gap-[2vh] mt-[1vh]">
                <div className="flex items-center gap-[2vw]">
                  <div className="flex items-center justify-center rounded-full w-[4vw] h-[4vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                    <svg className="w-[2.5vw] h-[2.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>Market structure confirmed</span>
                </div>
                <div className="flex items-center gap-[2vw]">
                  <div className="flex items-center justify-center rounded-full w-[4vw] h-[4vw]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB' }}>
                    <svg className="w-[2.5vw] h-[2.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <span style={{ color: '#EF4444', fontSize: '2.5vw' }}>Max daily loss reached</span>
                </div>
              </div>
              <div className="w-full py-[2vw] rounded font-bold text-center mt-[1vh]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB', fontSize: '3vw' }}>
                TRADE BLOCKED
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4 */}
        {currentSlide === 3 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-[6vw] gap-[4vh]">
            <h2 className="font-bold text-center leading-tight" style={{ color: '#F9FAFB', fontSize: '4.5vw' }}>
              Tradify enforces your strategy before you trade.
            </h2>
            <div className="w-full max-w-[70vw] rounded-xl border p-[4vw] shadow-2xl flex flex-col gap-[2vh]" style={{ backgroundColor: '#111827', borderColor: '#00D9A3' }}>
              <h2 className="font-bold text-center tracking-wider" style={{ color: '#6B7280', fontSize: '2.5vw' }}>PRE-TRADE CHECKLIST</h2>
              <div className="flex flex-col gap-[2vh] mt-[1vh]">
                <div className="flex items-center gap-[2vw]">
                  <div className="flex items-center justify-center rounded-full w-[4vw] h-[4vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                    <svg className="w-[2.5vw] h-[2.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>Market structure confirmed</span>
                </div>
                <div className="flex items-center gap-[2vw]">
                  <div className="flex items-center justify-center rounded-full w-[4vw] h-[4vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                    <svg className="w-[2.5vw] h-[2.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span style={{ color: '#F9FAFB', fontSize: '2.5vw' }}>Risk parameters valid</span>
                </div>
              </div>
              <div className="w-full py-[2vw] rounded font-bold text-center mt-[1vh]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '3vw' }}>
                TRADE APPROVED
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 5 */}
        {currentSlide === 4 && (
          <div className="w-full h-full flex flex-col items-center justify-center p-[8vw] gap-[4vh]">
            <h1 className="font-bold text-center leading-tight" style={{ color: '#00D9A3', fontSize: '7vw' }}>
              YOUR RULES. ENFORCED.
            </h1>
            <p className="text-center" style={{ color: '#6B7280', fontSize: '3.5vw' }}>
              Stop blowing accounts.
            </p>
            <button 
              className="mt-[2vh] w-[60vw] py-[4vw] rounded-lg font-bold tracking-wide uppercase"
              style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '4vw' }}
            >
              Start Free
            </button>
            <span style={{ color: '#6B7280', fontSize: '2.5vw' }}>tradifyapp.com</span>
          </div>
        )}

      </div>

      {/* Navigation Arrows */}
      {currentSlide > 0 && (
        <button 
          onClick={prevSlide}
          className="absolute left-[2vw] top-1/2 -translate-y-1/2 w-[8vw] h-[8vw] flex items-center justify-center rounded-full bg-opacity-50 hover:bg-opacity-100 transition-all z-20"
          style={{ backgroundColor: '#1F2937', color: '#F9FAFB' }}
        >
          <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}

      {currentSlide < 4 && (
        <button 
          onClick={nextSlide}
          className="absolute right-[2vw] top-1/2 -translate-y-1/2 w-[8vw] h-[8vw] flex items-center justify-center rounded-full bg-opacity-50 hover:bg-opacity-100 transition-all z-20"
          style={{ backgroundColor: '#1F2937', color: '#F9FAFB' }}
        >
          <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Dot Indicators */}
      <div className="absolute bottom-[4vh] flex gap-[2vw] z-20">
        {[0, 1, 2, 3, 4].map((index) => (
          <div 
            key={index}
            className="w-[2vw] h-[2vw] rounded-full transition-all"
            style={{ backgroundColor: currentSlide === index ? '#00D9A3' : '#1F2937' }}
          />
        ))}
      </div>
    </div>
  );
}
