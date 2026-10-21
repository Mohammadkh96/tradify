export type LocalAuthResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
  };
  traderProfile?: unknown;
  coachProfile?: unknown;
  coachApplicationStatus?: string | null;
  verification?: {
    available: boolean;
    sent: boolean;
    queued?: boolean;
    status: 'PENDING' | 'VERIFIED';
    deliveryConfigured: boolean;
  };
};

export type LocalAuthError = Error & {
  status?: number;
  code?: string;
};

async function localAuthRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/auth/local/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'We could not complete your request.') as LocalAuthError;
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data as T;
}

export function signUpWithLocal(email: string, password: string, displayName: string): Promise<LocalAuthResponse> {
  return localAuthRequest<LocalAuthResponse>('signup', {
    email: email.trim(),
    password,
    displayName: displayName.trim(),
    consentAccepted: true,
  });
}

export function signInWithLocal(email: string, password: string): Promise<LocalAuthResponse> {
  return localAuthRequest<LocalAuthResponse>('login', {
    email: email.trim(),
    password,
  });
}

export function resendLocalVerification(): Promise<{ verification: NonNullable<LocalAuthResponse['verification']> }> {
  return localAuthRequest('verification/resend');
}

export function completeLocalVerification(token: string): Promise<{ status: 'COMPLETED'; emailVerified: true }> {
  return localAuthRequest('verification/complete', { token });
}

export function requestLocalPasswordReset(email: string): Promise<{ message: string }> {
  return localAuthRequest('password-reset/request', { email: email.trim() });
}

export function completeLocalPasswordReset(token: string, password: string): Promise<{ status: 'COMPLETED' }> {
  return localAuthRequest('password-reset/complete', { token, password });
}