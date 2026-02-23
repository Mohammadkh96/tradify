declare global {
  interface Window {
    fbq: ((...args: any[]) => void) | undefined;
  }
}

export function trackFBEvent(eventName: string, params?: Record<string, any>) {
  try {
    if (typeof window.fbq === 'function') {
      if (params) {
        window.fbq('track', eventName, params);
      } else {
        window.fbq('track', eventName);
      }
      console.log(`[Meta Pixel] Event fired: ${eventName}`, params || '');
    } else {
      console.warn(`[Meta Pixel] fbq not available when trying to fire: ${eventName}`);
      let attempts = 0;
      const retry = setInterval(() => {
        attempts++;
        if (typeof window.fbq === 'function') {
          if (params) {
            window.fbq('track', eventName, params);
          } else {
            window.fbq('track', eventName);
          }
          console.log(`[Meta Pixel] Event fired (retry ${attempts}): ${eventName}`, params || '');
          clearInterval(retry);
        } else if (attempts >= 10) {
          console.warn(`[Meta Pixel] Gave up after ${attempts} retries: ${eventName}`);
          clearInterval(retry);
        }
      }, 500);
    }
  } catch (err) {
    console.error(`[Meta Pixel] Error firing event ${eventName}:`, err);
  }
}
