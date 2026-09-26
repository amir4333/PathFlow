/**
 * Student & Teacher Authentication Client
 *
 * Implements client-side authentication against the PathFlow backend:
 * - Registration
 * - Login
 * - Current user validation
 * - Safe session token storage in browser localStorage
 */

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly role: 'student' | 'teacher';
}

export interface AuthSession {
  readonly user: AuthUser;
  readonly token: string;
  readonly serverUrl: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'pathflow_auth_session';

export function loadStoredSession(): AuthSession | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Failed to persist auth session to localStorage', err);
  }
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class AuthError extends Error {
  readonly statusCode?: number;
  readonly isNetworkError: boolean;

  constructor(message: string, statusCode?: number, isNetworkError = false) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
  }
}

export async function registerUser(
  serverUrl: string,
  email: string,
  password: string,
  role: 'student' | 'teacher' = 'student'
): Promise<AuthSession> {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/auth/register`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        role,
      }),
    });
  } catch (err: any) {
    throw new AuthError(
      'Server unavailable. Could not connect to remote backend.',
      undefined,
      true
    );
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const msg = data.error || `Registration failed with HTTP ${response.status}`;
    throw new AuthError(msg, response.status);
  }

  const session: AuthSession = {
    user: data.user,
    token: data.token,
    serverUrl,
  };
  saveStoredSession(session);
  return session;
}

export async function loginUser(
  serverUrl: string,
  email: string,
  password: string
): Promise<AuthSession> {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/auth/login`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });
  } catch (err: any) {
    throw new AuthError(
      'Server unavailable. Could not connect to remote backend.',
      undefined,
      true
    );
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const msg = data.error || `Login failed with HTTP ${response.status}`;
    throw new AuthError(msg, response.status);
  }

  const session: AuthSession = {
    user: data.user,
    token: data.token,
    serverUrl,
  };
  saveStoredSession(session);
  return session;
}

export async function verifyUserSession(
  serverUrl: string,
  token: string
): Promise<AuthUser> {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/auth/me`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err: any) {
    throw new AuthError('Server unavailable', undefined, true);
  }

  if (!response.ok) {
    throw new AuthError(`Session expired or invalid (HTTP ${response.status})`, response.status);
  }

  const data = await response.json();
  return data.user as AuthUser;
}
