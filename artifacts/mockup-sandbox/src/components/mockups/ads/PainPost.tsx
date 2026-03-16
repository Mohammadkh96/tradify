import React from 'react';

export function PainPost() {
  return (
    <div 
      className="w-screen h-screen overflow-hidden flex flex-col relative"
      style={{ backgroundColor: '#0A0F1E', fontFamily: "'Inter', sans-serif" }}
    >
      {/* Split Content */}
      <div className="flex flex-1 w-full h-[90vh]">
        {/* Left Side - Text */}
        <div className="w-1/2 h-full flex flex-col justify-center px-[4vw] relative">
          {/* Logo */}
          <div className="absolute top-[4vh] left-[4vw] flex flex-col">
            <span className="font-bold tracking-tight" style={{ color: '#00D9A3', fontSize: '2vw' }}>TRADIFY</span>
            <span style={{ color: '#6B7280', fontSize: '1vw' }}>Your Rules. Enforced.</span>
          </div>

          <h1 className="font-bold leading-tight" style={{ color: '#F9FAFB', fontSize: '5.5vw' }}>
            YOUR STRATEGY ISN'T THE PROBLEM.
          </h1>
          <h2 className="font-bold mt-[2vh]" style={{ color: '#00D9A3', fontSize: '4vw' }}>
            Your behavior is.
          </h2>
          <p className="mt-[3vh] max-w-[85%]" style={{ color: '#6B7280', fontSize: '1.8vw', lineHeight: '1.5' }}>
            Tradify enforces your rules before every trade. Stop revenge trading. Stop blowing accounts.
          </p>
        </div>

        {/* Right Side - UI Mockup */}
        <div className="w-1/2 h-full flex items-center justify-center p-[4vw]" style={{ backgroundColor: '#111827' }}>
          <div className="w-full max-w-[40vw] rounded-xl border p-[2vw] shadow-2xl flex flex-col gap-[2vh]" style={{ backgroundColor: '#0A0F1E', borderColor: '#1F2937' }}>
            <h2 className="font-bold text-center tracking-wider" style={{ color: '#6B7280', fontSize: '1.5vw' }}>PRE-TRADE CHECKLIST</h2>
            
            <div className="flex flex-col gap-[1.5vh] mt-[1vh]">
              <div className="flex items-center gap-[1.5vw]">
                <div className="flex items-center justify-center rounded-full w-[2.5vw] h-[2.5vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ color: '#F9FAFB', fontSize: '1.6vw' }}>Market structure confirmed</span>
              </div>
              
              <div className="flex items-center gap-[1.5vw]">
                <div className="flex items-center justify-center rounded-full w-[2.5vw] h-[2.5vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ color: '#F9FAFB', fontSize: '1.6vw' }}>Risk &lt; 1% verified</span>
              </div>

              <div className="flex items-center gap-[1.5vw]">
                <div className="flex items-center justify-center rounded-full w-[2.5vw] h-[2.5vw]" style={{ backgroundColor: '#00D9A3', color: '#0A0F1E' }}>
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span style={{ color: '#F9FAFB', fontSize: '1.6vw' }}>Session time valid</span>
              </div>

              <div className="flex items-center gap-[1.5vw]">
                <div className="flex items-center justify-center rounded-full w-[2.5vw] h-[2.5vw]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB' }}>
                  <svg className="w-[1.5vw] h-[1.5vw]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <span style={{ color: '#EF4444', fontSize: '1.6vw' }}>Entry signal triggered</span>
              </div>
            </div>

            <div className="w-full py-[1.5vw] rounded font-bold text-center mt-[2vh]" style={{ backgroundColor: '#EF4444', color: '#F9FAFB', fontSize: '2vw' }}>
              TRADE BLOCKED
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Strip - CTA */}
      <div 
        className="h-[10vh] w-full flex items-center justify-center font-bold tracking-widest"
        style={{ backgroundColor: '#00D9A3', color: '#0A0F1E', fontSize: '2vw' }}
      >
        START FREE — TRADIFYAPP.COM
      </div>
    </div>
  );
}
