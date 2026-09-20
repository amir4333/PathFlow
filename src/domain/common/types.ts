/**
 * Common domain primitives, identifier types, and timestamp utilities.
 * Pure TypeScript - Zero dependencies on UI, browser DOM, or storage layers.
 */

/**
 * Standard identifier type across all PathFlow domain entities.
 * UUID v4 format string ensuring distributed, collision-resistant generation offline.
 */
export type EntityId = string;

/**
 * Generates a new EntityId.
 * Uses native Web Crypto API (crypto.randomUUID) when available,
 * with an RFC4122 v4 compliant fallback for universal runtime compatibility.
 */
export function generateEntityId(): EntityId {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates whether an unknown value qualifies as a valid non-empty EntityId.
 */
export function isValidEntityId(id: unknown): id is EntityId {
  return typeof id === 'string' && id.trim().length > 0;
}

/**
 * ISO 8601 UTC timestamp string representation (e.g., "2026-09-20T08:50:00.000Z").
 * Provides deterministic chronological ordering, JSON serializability, and timezone neutrality.
 */
export type Timestamp = string;

/**
 * Creates a normalized ISO 8601 UTC timestamp string.
 */
export function createTimestamp(date?: Date | number | string): Timestamp {
  if (date === undefined) {
    return new Date().toISOString();
  }
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date provided to createTimestamp: ${date}`);
  }
  return parsed.toISOString();
}

/**
 * Validates whether a value is a valid parseable ISO timestamp string.
 */
export function isValidTimestamp(val: unknown): val is Timestamp {
  if (typeof val !== 'string' || val.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(val);
  return !isNaN(parsed);
}

/**
 * Computes elapsed duration in whole minutes between two timestamps.
 * Returns 0 if endedAt is identical to startedAt.
 */
export function calculateDurationMinutes(startedAt: Timestamp, endedAt: Timestamp): number {
  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (isNaN(startMs) || isNaN(endMs)) {
    throw new Error('Invalid timestamp provided to calculateDurationMinutes');
  }
  return Math.max(0, Math.round((endMs - startMs) / (1000 * 60)));
}
