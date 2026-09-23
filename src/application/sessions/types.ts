/**
 * Session History Query & Aggregation Types
 *
 * Defines contracts for querying historical sessions, applying multi-dimensional
 * filters, and returning derived read-only summary aggregations.
 */

import { EntityId, Session } from '../../domain';

/**
 * Filter criteria for completed session history.
 * All properties are optional; an empty filter returns all completed sessions.
 */
export interface SessionHistoryFilter {
  /**
   * Optional start date or timestamp boundary (inclusive).
   * Can be Gregorian YYYY-MM-DD, Jalali YYYY-MM-DD, or full ISO timestamp.
   */
  readonly startDate?: string;

  /**
   * Optional end date or timestamp boundary (inclusive through end of calendar day).
   * Can be Gregorian YYYY-MM-DD, Jalali YYYY-MM-DD, or full ISO timestamp.
   */
  readonly endDate?: string;

  /**
   * Optional Task identifier filter.
   */
  readonly taskId?: EntityId;

  /**
   * Optional Roadmap identifier filter.
   * Returns all sessions belonging to tasks under this roadmap.
   */
  readonly roadmapId?: EntityId;
}

/**
 * Derived read-only summary aggregation for a session history result set.
 */
export interface SessionHistoryAggregation {
  /**
   * Total number of completed sessions matching the filter.
   */
  readonly totalSessions: number;

  /**
   * Total focused minutes across matching sessions.
   */
  readonly totalMinutes: number;

  /**
   * Breakdown into whole hours and remaining minutes.
   */
  readonly hours: number;
  readonly minutes: number;
}

/**
 * Immutable result model returned by session history queries.
 */
export interface SessionHistoryResult {
  /**
   * Chronologically sorted matching sessions (default: newest first).
   */
  readonly sessions: readonly Session[];

  /**
   * Total number of matching sessions.
   */
  readonly totalSessions: number;

  /**
   * Total focused minutes across matching sessions.
   */
  readonly totalMinutes: number;

  /**
   * Derived hour and minute breakdown.
   */
  readonly totalHoursAndMinutes: {
    readonly hours: number;
    readonly minutes: number;
  };
}
