import React from 'react';

export function PainReel() {
  return (
    <div 
      className="w-screen h-screen overflow-hidden relative flex flex-col items-center"
      style={{ backgroundColor: '#0A0F1E', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Logo */}
      <div className="absolute top-[3vh] left-[4vw] flex flex-col">
        <span className="font-bold tracking-tight" style={{ color: '#00D9A3', fontSize: '4vw' }}>TRADIFY</span>
        <span style={{ color: '#6B7280', fontSize: '2vw' }}>Your Rules. Enforced.</span>
      </div>

      {/* Top Third - Hook */}
      <div className="mt-[15vh] w-[85vw] text-center">
        <h1 
          className="font-bold leading-tight" 
          style={{ color: '#F9FAFB', fontSize: '8vw', textTransform: 'uppercase' }}
        >
          Your strategy isn't the problem.
        </h1>
      </div>

      {/* Middle - Hero Visual (Checklist UI) */}
      <div className="mt-[6vh] w-[85vw] rounded-xl border p-[4vw] shadow-2xl flex flex-col gap-[3vh]" style={{ backgroundColor: '#111827', borderColor: '#1F2937' }}>
        <h2 className="font-bold text-center tracking-wider" style={{ color: '#6B7280', fontSize: '3.5vw' }}>PRE-TRADE CHECKLIST</h2>
        
        <div className="flex flex-col gap-[2vh]">
          <div className="flex items-center gap-[3vw]">
            <div className="flex items-center justify-center rounded-full w-[6vw] h-[6vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
              <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <span style={{ color: '#F9FAFB', fontSize: '3.5vw' }}>Market structure confirmed</span>
          </div>
          
          <div className="flex items-center gap-[3vw]">
            <div className="flex items-center justify-center rounded-full w-[6vw] h-[6vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
              <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <span style={{ color: '#F9FAFB', fontSize: '3.5vw' }}>Risk &lt; 1% verified</span>
          </div>

          <div className="flex items-center gap-[3vw]">
            <div className="flex items-center justify-center rounded-full w-[6vw] h-[6vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
              <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <span style={{ color: '#F9FAFB', fontSize: '3.5vw' }}>Session time valid</span>
          </div>

          <div className="flex items-center gap-[3vw]">
            <div className="flex items-center justify-center rounded-full w-[6vw] h-[6vw]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB' }}>
              <svg className="w-[4vw] h-[4vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <span style={{ color: '#EF4444', fontSize: '3.5vw' }}>Entry signal triggered</span>
          </div>
        </div>

        <div className="w-full py-[3vw] rounded font-bold text-center mt-[1vh]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB', fontSize: '4vw' }}>
          TRADE BLOCKED
        </div>
      </div>

      {/* Bottom Quarter - CTA (Stays above bottom 35% mostly) */}
      <div className="absolute top-[60vh] flex flex-col items-center gap-[2vh] w-full px-[8vw]">
        <div className="font-bold text-center" style={{ color: '#00D9A3', fontSize: '4.5vw' }}>
          Your Rules. Enforced.
        </div>
        <button 
          className="w-[70vw] py-[4vw] rounded-lg font-bold tracking-wide shadow-lg uppercase"
          style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '5vw' }}
        >
          Start Free
        </button>
        <span style={{ color: '#6B7280', fontSize: '3vw' }}>tradifyapp.com</span>
      </div>
    </div>
  );
}
