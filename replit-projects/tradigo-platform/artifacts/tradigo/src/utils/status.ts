// Centralized Status Mapping
import { UserStatus, CoachApplicationState, CoachPresenceState, SessionState, PaymentState, PayoutState } from '../types';

export type SemanticTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusConfig {
  label: string;
  tone: SemanticTone;
}

export const USER_STATUS_MAP: Record<UserStatus, StatusConfig> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'warning' },
  BANNED: { label: 'Banned', tone: 'danger' },
  DELETED: { label: 'Deleted', tone: 'default' },
};

export const COACH_APPLICATION_MAP: Record<CoachApplicationState, StatusConfig> = {
  DRAFT: { label: 'Draft', tone: 'info' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SUSPENDED: { label: 'Suspended', tone: 'warning' },
  REVOKED: { label: 'Revoked', tone: 'danger' },
};

export const PRESENCE_STATE_MAP: Record<CoachPresenceState, StatusConfig> = {
  OFFLINE: { label: 'Offline', tone: 'default' },
  AVAILABLE: { label: 'Available', tone: 'success' },
  BUSY: { label: 'Busy', tone: 'danger' },
  IN_SESSION: { label: 'In Session', tone: 'warning' },
  AWAY: { label: 'Away', tone: 'info' },
};
