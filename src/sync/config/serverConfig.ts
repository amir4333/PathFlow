/**
 * Server & Client Sync Configuration
 *
 * Manages remote backend URL and persistent Device ID.
 * Follows zero hardcoded production secrets guidelines.
 */

import { generateEntityId } from '../../domain';

export const SERVER_URL_STORAGE_KEY = 'pathflow_server_url';
export const DEVICE_ID_STORAGE_KEY = 'pathflow_device_id';

export function getDefaultServerUrl(): string {
  // 1. Environment variable injected at build time
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) {
    const envUrl = String(import.meta.env.VITE_BACKEND_URL).trim().replace(/\/+$/, '');
    if (envUrl.length > 0) {
      return envUrl;
    }
  }

  // 2. In production browser runtime, use current origin as default backend (e.g. reverse proxy)
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  }

  // 3. Default local development backend port
  return 'http://localhost:3001';
}

export function getStoredServerUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (stored && stored.trim().length > 0) {
      return stored.trim();
    }
  }
  return getDefaultServerUrl();
}

export function saveStoredServerUrl(url: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed.length > 0) {
      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, trimmed);
    } else {
      window.localStorage.removeItem(SERVER_URL_STORAGE_KEY);
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
