/**
 * Server & Client Sync Configuration
 *
 * Manages remote backend URL and persistent Device ID.
 * Follows zero hardcoded production secrets guidelines.
 */

import { generateEntityId } from '../../domain';

export const SERVER_URL_STORAGE_KEY = 'pathflow_server_url';
export const DEVICE_ID_STORAGE_KEY = 'pathflow_device_id';

export function isValidServerUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.host;
  } catch {
    return false;
  }
}

export function getDefaultServerUrl(): string {
  // 1. Environment variable injected at build time (supports VITE_API_BASE_URL and VITE_BACKEND_URL)
  if (typeof import.meta !== 'undefined') {
    const envUrl = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_BACKEND_URL;
    if (envUrl) {
      const clean = String(envUrl).trim().replace(/\/+$/, '');
      if (isValidServerUrl(clean)) {
        return clean;
      }
    }
  }

  // 2. In production browser runtime, use current origin as default backend (e.g. reverse proxy)
  // Ensure origin is a valid HTTP/HTTPS origin (not file:// or null when running in Electron or packaged desktop)
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin;
      if (isValidServerUrl(origin)) {
        return origin;
      }
    }
  }

  // 3. Default local development backend port
  return 'http://localhost:3001';
}

export function getStoredServerUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (stored && isValidServerUrl(stored)) {
      return stored.trim().replace(/\/+$/, '');
    }
    // Clean up invalid legacy entries (e.g. 'file://' or malformed values)
    if (stored) {
      window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
    }
  }
  return getDefaultServerUrl();
}

export function saveStoredServerUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
      return;
    }
    if (isValidServerUrl(trimmed)) {
      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, trimmed);
    }
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    let deviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) {
      deviceId = `dev_${generateEntityId()}`;
      window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  }
  return `dev_${generateEntityId()}`;
}
