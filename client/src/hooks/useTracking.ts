import { useEffect, useState, useCallback } from "react";
import { getCookiePreferences, hasAnalyticsConsent, hasMarketingConsent } from "@/components/CookieConsent";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export function useTrackingConsent() {
  const [analytics, setAnalytics] = useState(hasAnalyticsConsent());
  const [marketing, setMarketing] = useState(hasMarketingConsent());

  useEffect(() => {
    const handleConsentChange = (e: CustomEvent) => {
      setAnalytics(e.detail.analytics);
      setMarketing(e.detail.marketing);
    };

    window.addEventListener("cookie-consent-changed", handleConsentChange as EventListener);
    return () => {
      window.removeEventListener("cookie-consent-changed", handleConsentChange as EventListener);
    };
  }, []);

  return { analytics, marketing };
}

export function initGoogleAnalytics(measurementId: string) {
  if (!hasAnalyticsConsent()) {
    console.log("[Tracking] Google Analytics blocked - no consent");
    return;
  }

  if (window.gtag) {
    console.log("[Tracking] Google Analytics already initialized");
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    cookie_flags: "SameSite=None;Secure",
  });

  console.log("[Tracking] Google Analytics initialized");
}

export function trackPageView(path: string) {
  if (!hasAnalyticsConsent() || !window.gtag) return;
  
  window.gtag("event", "page_view", {
    page_path: path,
  });
}

export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (!hasAnalyticsConsent() || !window.gtag) return;
  
  window.gtag("event", eventName, params);
}

export function initFacebookPixel(pixelId: string) {
  if (!hasMarketingConsent()) {
    console.log("[Tracking] Facebook Pixel blocked - no consent");
    return;
  }

  if (window.fbq) {
    console.log("[Tracking] Facebook Pixel already initialized");
    return;
  }

  const n = window.fbq = function() {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  } as any;
  
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  if (window.fbq) {
    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  }

  console.log("[Tracking] Facebook Pixel initialized");
}

export function trackFacebookEvent(eventName: string, params?: Record<string, any>) {
  if (!hasMarketingConsent() || !window.fbq) return;
  
  window.fbq("track", eventName, params);
}

export function usePageTracking() {
  const { analytics } = useTrackingConsent();

  useEffect(() => {
    if (analytics && typeof window !== "undefined") {
      const path = window.location.pathname;
      trackPageView(path);
    }
  }, [analytics]);
}

export function useTracking() {
  const { analytics, marketing } = useTrackingConsent();

  const initAnalytics = useCallback((measurementId: string) => {
    if (analytics) {
      initGoogleAnalytics(measurementId);
    }
  }, [analytics]);

  const initMarketing = useCallback((pixelId: string) => {
    if (marketing) {
      initFacebookPixel(pixelId);
    }
  }, [marketing]);

  return {
    analyticsEnabled: analytics,
    marketingEnabled: marketing,
    initAnalytics,
    initMarketing,
    trackEvent,
    trackFacebookEvent,
    trackPageView,
  };
}
