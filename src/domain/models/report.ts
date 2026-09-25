/**
 * Official Progress Report Domain Models
 *
 * Defines the structured, strictly factual data contract for official progress reports.
 * Designed for academic evaluation, mentor review, student historical documentation,
 * and future export to PDF/HTML/JSON.
 *
 * Invariant: Must remain strictly observational and factual. No productivity scores,
 * rankings, grades, AI judgments, or subjective classifications.
 */

import { EntityId, Timestamp } from '../common';

export type ReportScopeType = 'all' | 'goal' | 'roadmap';

export interface ReportScope {
  readonly type: ReportScopeType;
  readonly goalId?: EntityId;
  readonly goalTitle?: string;
  readonly roadmapId?: EntityId;
  readonly roadmapTitle?: string;
}

export interface ReportReviewPeriod {
  readonly type: 'this-week' | 'last-week' | 'custom';
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string;   // YYYY-MM-DD
  readonly weekIdentifier?: string; // e.g. "2026-W39"
  readonly label: string;
}

export interface ReportMetadata {
  readonly title: string;
  readonly generatedAt: Timestamp; // ISO 8601
  readonly reviewPeriod: ReportReviewPeriod;
  readonly language: 'en' | 'fa';
  readonly calendar: 'gregorian' | 'persian';
  readonly scope: ReportScope;
}

export interface ReportOverview {
  readonly activeGoalsCount: number;
  readonly activeRoadmapsCount: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
  readonly totalTasksCount: number;
  // Selected period time metrics (in minutes)
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly varianceMinutes: number; // actual - planned
  readonly timeCompletionPercentage: number;
  readonly sessionCount: number;
  readonly plannedCommitmentsCount: number;
  readonly completedCommitmentsCount: number;
}

export interface ReportGoalItem {
  readonly id: EntityId;
  readonly title: string;
  readonly description?: string;
  readonly status: string;
  readonly overallProgressPercentage: number; // Lifetime task completion %
  readonly roadmapCount: number;
  readonly taskCount: number;
  readonly completedTaskCount: number;
  // Lifetime time metrics (minutes)
  readonly lifetimePlannedMinutes: number; // total estimated minutes
  readonly lifetimeActualMinutes: number;  // total recorded work minutes
  // Selected-period time metrics (minutes)
  readonly selectedPeriodPlannedMinutes: number;
  readonly selectedPeriodActualMinutes: number;
  readonly selectedPeriodSessionCount: number;
  readonly hasActivityInPeriod: boolean;
}

export interface ReportRoadmapItem {
  readonly id: EntityId;
  readonly title: string;
  readonly goalId: EntityId;
  readonly goalTitle: string;
  readonly status?: string;
  readonly overallProgressPercentage: number; // Lifetime task completion %
  readonly taskCount: number;
  readonly completedTaskCount: number;
  // Lifetime time metrics (minutes)
  readonly lifetimePlannedMinutes: number; // total estimated minutes
  readonly lifetimeActualMinutes: number;  // total recorded work minutes
  // Selected-period time metrics (minutes)
  readonly selectedPeriodPlannedMinutes: number;
  readonly selectedPeriodActualMinutes: number;
  readonly selectedPeriodSessionCount: number;
  readonly hasActivityInPeriod: boolean;
}

export interface ReportTaskItem {
  readonly id: EntityId;
  readonly title: string;
  readonly roadmapId?: EntityId;
  readonly roadmapTitle: string;
  readonly goalId?: EntityId;
  readonly goalTitle?: string;
  readonly status: string;
  readonly priority?: string;
  // Lifetime metrics
  readonly lifetimeEstimatedMinutes: number;
  readonly lifetimeActualMinutes: number;
  readonly lifetimeSessionCount: number;
  // Selected period metrics
  readonly selectedPeriodPlannedMinutes: number;
  readonly selectedPeriodActualMinutes: number;
  readonly selectedPeriodSessionCount: number;
  readonly isCompleted: boolean;
  readonly completionDate?: string;
}

export interface ReportSessionItem {
  readonly id: EntityId;
  readonly startedAt: Timestamp;
  readonly durationMinutes: number;
  readonly taskId: EntityId;
  readonly taskTitle: string;
  readonly roadmapTitle?: string;
  readonly notes?: string;
}

export interface ReportSessionsSummary {
  readonly totalSessionsCount: number;
  readonly totalDurationMinutes: number;
  readonly activeDaysCount: number;
  readonly recentSessions: readonly ReportSessionItem[];
}

export interface ReportWeeklyPlanCommitmentItem {
  readonly id: EntityId;
  readonly taskId: EntityId;
  readonly taskTitle: string;
  readonly roadmapTitle: string;
  readonly plannedMinutes: number;
  readonly targetDate?: string;
  readonly isCompleted: boolean;
}

export interface ReportWeeklyPlanningSummary {
  readonly plannedCommitmentsCount: number;
  readonly completedCommitmentsCount: number;
  readonly totalPlannedMinutes: number;
  readonly datedCommitmentsCount: number;
  readonly flexibleCommitmentsCount: number;
  readonly activeDaysCount: number;
  readonly commitments: readonly ReportWeeklyPlanCommitmentItem[];
}

export interface ReportDailyActivityItem {
  readonly date: string; // YYYY-MM-DD
  readonly dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  readonly plannedMinutes: number;
  readonly actualMinutes: number;
  readonly sessionCount: number;
  readonly tasksWorkedOnCount: number;
  readonly tasksCompletedCount: number;
}

export interface OfficialProgressReport {
  readonly metadata: ReportMetadata;
  readonly overview: ReportOverview;
  readonly goals: readonly ReportGoalItem[];
  readonly roadmaps: readonly ReportRoadmapItem[];
  readonly tasks: readonly ReportTaskItem[];
  readonly sessionsSummary: ReportSessionsSummary;
  readonly weeklyPlanning: ReportWeeklyPlanningSummary;
  readonly dailyActivity: readonly ReportDailyActivityItem[];
}
