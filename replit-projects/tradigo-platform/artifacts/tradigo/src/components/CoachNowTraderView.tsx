import React, { useState } from 'react';

export function CoachNowTraderView() {
  const [status, setStatus] = useState('idle');
  
  const submitRequest = async () => {
    setStatus('matching');
    const res = await fetch('/api/coach-now/requests', {
      method: 'POST',
      body: JSON.stringify({ instrument: 'BTC', specialty: 'DayTrading', language: 'en', idempotencyKey: crypto.randomUUID() }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
        setStatus('matched');
    } else {
        setStatus('error');
    }
  };

  return (
    <div>
      <button onClick={submitRequest} disabled={status !== 'idle'}>Coach Now</button>
      <p>Status: {status}</p>
    </div>
  );
}
