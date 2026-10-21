import { auth } from './firebase';

class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data: any = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export const apiClient = {
  async fetch(url: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Preview credentials are deliberately scoped to the signed preview
    // routes. Never let a preview/dev credential leak into production API
    // calls (or use a stale local development token as a user identity).
    const isPreviewRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/preview');
    const previewToken = isPreviewRoute ? sessionStorage.getItem('tradigo_preview_session') : null;
    const requestedUid = !previewToken ? auth.currentUser?.uid : undefined;

    if (previewToken) {
      headers.set('X-Tradigo-Preview-Session', previewToken);
    } else if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      // Firebase can switch accounts while token acquisition is in flight.
      // Never send the old account's token after that transition.
      if (auth.currentUser?.uid !== requestedUid) {
        throw new Error('Authentication changed while preparing the request.');
      }
      headers.set('Authorization', `Bearer ${token}`);
    }

    let targetUrl = url;
    if (url.startsWith('/') && !url.startsWith('/api')) {
      targetUrl = '/api' + url;
    }

    const response = await fetch(targetUrl, { ...options, headers, credentials: 'same-origin' });

    // A protected response must belong to the identity that authorized the
    // request. This prevents a slow response from account A being consumed
    // after Firebase has already switched to account B.
    if (requestedUid && auth.currentUser?.uid !== requestedUid) {
      throw new Error('Authentication changed while receiving the response.');
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }
      throw new ApiError(
        response.status,
        errorData?.error?.message || errorData?.message || 'API request failed',
        errorData
      );
    }

    // Handle 204 No Content
    if (response.status === 204) return null;
    
    return response.json();
  },

  get(url: string, options?: RequestInit) {
    return this.fetch(url, { ...options, method: 'GET' });
  },

  post(url: string, body?: any, options?: RequestInit) {
    return this.fetch(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put(url: string, body?: any, options?: RequestInit) {
    return this.fetch(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete(url: string, options?: RequestInit) {
    return this.fetch(url, { ...options, method: 'DELETE' });
  },
};
