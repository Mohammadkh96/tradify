type AnalyticsData = Record<string, string | number | boolean>;

/**
 * Safe aggregate events for the coach-application clarification funnel:
 *
 * | Event | Safe dimensions |
 * | --- | --- |
 * | clarification_request_opened | surface, application_attempt_state |
 * | clarification_request_submitted | surface, application_attempt_state |
 * | clarification_request_resolved | surface, application_attempt_state, outcome (`answered` or `closed`) |
 * | coach_application_resubmission_started | source, surface, application_attempt_state |
 *
 * Never add request text, reviewer text, identity, application IDs, or other
 * free-form applicant data to these events.
 */

declare global {
  interface Window {
    umami?: {
      track(name: string, data?: AnalyticsData): void;
    };
  }
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never break the app.
  }
}