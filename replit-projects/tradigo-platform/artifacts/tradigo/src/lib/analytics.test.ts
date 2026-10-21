import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete window.umami;
  });

  it('forwards safe event data to the tracker when it is available', () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent('clarification_request_resolved', {
      surface: 'admin_applications',
      application_attempt_state: 'REJECTED',
      outcome: 'answered',
    });

    expect(track).toHaveBeenCalledWith('clarification_request_resolved', {
      surface: 'admin_applications',
      application_attempt_state: 'REJECTED',
      outcome: 'answered',
    });
  });

  it('swallows tracker failures so application actions are not interrupted', () => {
    window.umami = {
      track: () => {
        throw new Error('analytics unavailable');
      },
    };

    expect(() => trackEvent('clarification_request_submitted', {
      surface: 'coach_application_status',
      application_attempt_state: 'REJECTED',
    })).not.toThrow();
  });
});