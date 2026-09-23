# PathFlow Progress & Review System Specification (Phase 6)

## Overview

The Progress & Review System provides deterministic, pure domain services to calculate, evaluate, and reconstruct historical progress metrics across arbitrary review horizons. It translates raw, immutable execution records (**Tasks**, **Sessions**, and **Weekly Plans**) into clear, transparent, and actionable feedback.

Like all PathFlow subsystems, Progress & Review is designed under strict architectural invariants:
* **Pure Domain Services**: 100% decoupled from React, UI state, browser APIs, and database adapters.
* **Derived-on-Demand State**: No mutable "Progress" database tables or redundant snapshot documents. Progress is computed dynamically from primary records, guaranteeing that calculations can never drift out of sync.
* **Unified Domain**: Academic Learning and Game Systems Lab share the exact same progress models and evaluation pipelines.
* **Historical Non-Destructiveness**: Past sessions, completed weeks, and historical achievements are preserved immutably.
* **Deterministic & Explainable**: Progress percentages and variances use transparent arithmetic without magic formulas or opaque scoring.

---

## 1. Progress Derivation Philosophy

### Why Derived Rather Than Stored?
In traditional architectures, developers frequently create mutable `Progress` rows in databases (e.g. `progressPercentage: 45.5`) that are incrementally mutated upon every event. This pattern suffers from critical flaws:
1. **State Drift & Inconsistency**: If a session duration is edited, deleted, or inserted retroactively, cached percentages become invalid unless complex cache-invalidation transactions are maintained.
2. **Loss of Auditability**: Storing only the end percentage loses the context of *why* the number changed (e.g. was a task completed early, or did the student spend 4 hours in overtime?).
3. **Database Bloat**: Daily, weekly, and monthly snapshot tables duplicate gigabytes of data that could be derived directly from session timestamps.

**PathFlow's Invariant**: *All progress metrics are pure functions of primary records:*
$$\text{Progress} = f(\text{Goals}, \text{Roadmaps}, \text{Tasks}, \text{Sessions}, \text{WeeklyPlans})$$

### Separation of Task vs. Time Progress
PathFlow explicitly separates two distinct concepts of progress:
* **Task Completion Percentage**: The proportion of discrete work units finalized ($\frac{\text{Completed Tasks}}{\text{Total Active Tasks}}$).
* **Time Completion Percentage**: The proportion of planned or estimated time invested ($\frac{\text{Actual Minutes}}{\text{Planned Minutes}}$).

Conflating these metrics into a single arbitrary score creates false impressions (e.g. a student who completed 1 of 10 tasks but spent 100% of their estimated time might appear 100% "complete" if only time were tracked, or 10% "complete" if only tasks were tracked). Exposing both gives students and teachers clear, unambiguous visibility.

---

## 2. Daily Progress Summary

The `calculateDailyProgressSummary` function generates structured review metrics for any calendar day (`YYYY-MM-DD`).

### Data Structure: `DailyProgressSummary`
* `date: string` — ISO calendar date (`YYYY-MM-DD`).
* `totalActualMinutes: number` — Total duration in minutes of valid sessions started on that date.
* `sessionCount: number` — Number of sessions logged.
* `plannedMinutes: number` — Total planned minutes allocated for this date across weekly plans.
* `plannedVsActual: PlannedVsActualComparison` — Planned vs. actual comparison including variance and percentage.
* `workedOnTaskCount: number` — Number of distinct tasks with sessions on this date.
* `completedTaskCount: number` — Number of completed tasks associated with this day's work or plans.
* `taskCompletionPercentage: number` — Percentage of planned tasks completed, or worked tasks completed.
* `timeCompletionPercentage: number` — Percentage of planned time fulfilled.
* `tasksWorkedOn: readonly DailyTaskActivityDetail[]` — Breakdown of each task worked on (title, roadmap, actual minutes, session count, variance, completion status).
* `tasksCompleted: readonly DailyTaskActivityDetail[]` — List of completed tasks for that day.

---

## 3. Weekly Progress Summary

The `calculateWeeklyReviewSummary` function generates historical or current progress reviews for any ISO 8601 calendar week (`YYYY-Www`).

### Key Capabilities
* **Historical Independence**: Any past week (e.g. `2026-W36`, `2026-W37`, `2026-W38`) can be queried at any time.
* **Flexible Planning Support**: Accurately analyzes weeks with full Weekly Plans, weeks with unallocated weekly commitments, weeks with daily allocations, and weeks where sessions were logged without any prior plan.
* **Hierarchical Rollup**: Automatically rolls up task session activity into roadmap-level and goal-level contributions (`RoadmapReviewProgress` and `GoalReviewProgress`).

---

## 4. Multi-Level Progress Calculation

Progress in PathFlow operates seamlessly across four distinct structural tiers:

```
Goal
 └── Roadmap(s)
      └── Task(s)
           └── Session(s) / Planned Allocation(s)
```

### 1. Task Level (`TaskDetailedProgress`)
* Evaluates task status (`todo`, `in_progress`, `completed`, `blocked`, `cancelled`).
* Tracks estimated minutes, planned minutes across weekly plans, actual logged session minutes, and session count.
* Variance: $\text{Variance} = \text{Actual Minutes} - \text{Estimated Minutes}$.

### 2. Roadmap Level (`RoadmapDetailedProgress`)
* Aggregates tasks belonging to the roadmap.
* Active Tasks = $\text{Total Tasks} - \text{Cancelled Tasks}$.
* Task Completion % = $\text{round}\left(\frac{\text{Completed Tasks}}{\text{Active Tasks}} \times 100\right)$ (or 0 if no active tasks).
* Preserves actual minutes from cancelled tasks in `totalActualMinutes` (ensuring logged effort is never lost).
* Time Completion % = $\text{round}\left(\frac{\text{Total Actual Minutes}}{\text{Total Estimated Minutes}} \times 100\right)$.

### 3. Goal Level (`GoalDetailedProgress`)
* Aggregates all constituent roadmaps for a Goal.
* Reports total roadmaps and `completedRoadmaps` (roadmaps where all active tasks are completed).
* Computes aggregate task completion percentage and time completion percentage.
* Retains roadmap progress collection for drill-down inspection.

---

## 5. Planned vs. Actual Calculation Rules & Edge Cases

| Scenario | Inputs | Behavior / Output |
| :--- | :--- | :--- |
| **Empty Period / Zero Data** | `planned = 0`, `actual = 0` | `variance = 0`, `percentage = 0`. No division by zero. |
| **Planned but No Actual Work** | `planned = 120`, `actual = 0` | `variance = -120` (under budget), `percentage = 0%`. |
| **Actual Work Without Plan** | `planned = 0`, `actual = 75` | `variance = +75`, `percentage = 0%`. Avoids `NaN` / `Infinity`. |
| **Overtime Work** | `planned = 60`, `actual = 90` | `variance = +30`, `percentage = 150%`. Accurately reflects extra effort. |
| **Completed Early** | `planned = 120`, `actual = 80`, `status = completed` | `variance = -40`, `percentage = 67%`, `isCompleted = true`. |
| **Cancelled Tasks** | `status = cancelled`, `actual = 30` | Excluded from active denominator in task completion %, but the 30 actual minutes remain in actual time. |
| **Boundary Sessions** | Session starts 23:59:00 | Grouped by the start timestamp's calendar date (`YYYY-MM-DD`). |

---

## 6. Historical Activity Aggregation & Time Series

PathFlow provides pure aggregation utilities across arbitrary dimensions:
1. `aggregateActivityByDate(sessions, range?)` — Chronological daily activity summaries.
2. `aggregateActivityByWeek(sessions)` — ISO week groupings with period start and end boundaries.
3. `aggregateActivityByTask(sessions, tasks?)` — Per-task historical totals, session counts, and first/last session timestamps.
4. `aggregateActivityByRoadmap(sessions, tasks, roadmaps?)` — Per-roadmap historical effort.
5. `aggregateActivityByGoal(sessions, tasks, roadmaps, goals?)` — Per-goal historical effort.
6. `calculateProgressOverTime({ range, sessions, weeklyPlans?, tasks? })` — Chronological daily time points containing daily planned, daily actual, daily variance, cumulative planned, cumulative actual, and cumulative variance.
7. `reconstructProjectHistory({ goals, roadmaps, tasks, sessions, asOfDate? })` — Point-in-time historical reconstruction without storing redundant snapshot states.

---

## 7. Teacher & Student Review Report

To cleanly feed future Teacher View dashboards and student self-review screens, `generateProgressReviewReport` packages all metrics into an immutable, single-call data structure:

```ts
export interface ProgressReviewReport {
  readonly generatedAt: Timestamp;
  readonly period: DateRange;
  readonly executiveSummary: {
    readonly totalActualMinutes: number;
    readonly totalEstimatedMinutes: number;
    readonly totalPlannedMinutes: number;
    readonly totalSessions: number;
    readonly totalGoals: number;
    readonly totalRoadmaps: number;
    readonly totalTasks: number;
    readonly completedTasks: number;
    readonly inProgressTasks: number;
    readonly overallTaskCompletionPercentage: number;
    readonly overallTimeCompletionPercentage: number;
    readonly totalVarianceMinutes: number;
  };
  readonly goals: readonly GoalDetailedProgress[];
  readonly roadmaps: readonly RoadmapDetailedProgress[];
  readonly recentWeeks: readonly WeeklyReviewSummary[];
  readonly timeSeries: readonly ProgressTimePoint[];
  readonly activityByDate: readonly DateActivityItem[];
  readonly activityByTask: readonly TaskActivityItem[];
}
```

This ensures future UI components in Phase 7 and beyond consume pure, validated domain data without needing knowledge of IndexedDB schemas, Dexie queries, or complex data aggregation logic.

---

## 8. Progress Visualizations & Trends (Phase 11B)

The UI visualization layer renders deterministic, accessible charts directly derived from `ComprehensivePeriodReview` without adding heavy external dependencies or duplicating domain logic.

### Available Visualizations

1. **Daily Planned vs. Actual Chart (`PlannedVsActualDailyChart`)**
   - **Data Source**: `reviewData.dailyBreakdown` (derived via `preparePlannedVsActualDailyData`).
   - **Visual Format**: Paired vertical bars for each day comparing planned duration vs. logged session duration.
   - **Key Features**: Side-by-side comparison, exact numeric minute tooltips, difference variance display (`+/-`), and an accessible toggleable data table.
   - **Neutrality**: Purely comparative; no judgments or failure indicators.

2. **Actual Time Trend (`ActualTimeTrendChart`)**
   - **Data Source**: `reviewData.dailyBreakdown` (derived via `prepareActualTimeTrendData`).
   - **Visual Format**: Clean SVG area and polyline chart displaying daily session duration progression across the active period.
   - **Key Features**: Interactive focusable/hoverable data points, session count tooltips, dashed reference lines, and an objective daily average badge (`Avg Xh Ym / day`).
   - **Neutrality**: Labeled strictly "Actual Time"; avoids speculative forecasting or "productivity trend" terminology.

3. **Task Completion Trend (`TaskCompletionTrendChart`)**
   - **Data Source**: `reviewData.dailyBreakdown` (derived via `prepareTaskCompletionTrendData`).
   - **Visual Format**: Grouped indicator bars for each calendar day showing tasks worked on alongside tasks completed.
   - **Key Features**: Differentiates discrete activity from completions, exact counts, localized day labels.
   - **Neutrality**: Presents factual counts without scoring or ranking days.

4. **Roadmap Time Distribution (`RoadmapTimeDistributionChart`)**
   - **Data Source**: `reviewData.roadmaps` (derived via `prepareRoadmapDistributionData`).
   - **Visual Format**: Proportional horizontal bar chart displaying actual session hours allocated per roadmap.
   - **Key Features**: Exact duration formatting, percentage of total actual time, parent goal context badge, graceful handling of unassigned roadmaps (`General`).
   - **Neutrality**: Reflects actual time investment without imposing priority rankings.

5. **Goal & Roadmap Progress Bars (`GoalProgressSection`, `RoadmapProgressSection`)**
   - **Data Source**: Domain-calculated `taskCompletionPercentage`.
   - **Visual Format**: Compact, high-contrast progress tracks with exact task fractions (`X / Y tasks`) and percentage text.
   - **Key Features**: Standard ARIA `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax="100"`.

### Review-Period Synchronization
All visualizations receive props directly from `reviewData` in `ProgressView`. When the period filter changes (This Week, Last Week, or Custom Range), all visualizations refresh atomically with zero state drift or redundant queries.

### Accessibility & Localization
* **Screen Reader Support**: Standard ARIA attributes (`role="region"`, `role="tooltip"`, `role="progressbar"`, `tabIndex={0}` on interactive points, toggleable data table).
* **Color Independence**: Color coding is always paired with shape distinctions, labels, and numeric values.
* **Dual Calendar & Language**: Respects Gregorian and Persian calendars and English/Persian languages, utilizing `useUserPreferences()` for dates, numbers, and day names.

### Empty-State Handling
When a period has no logged sessions or planned commitments, each visualization displays a clean, compact empty state rather than deceptive zero-axes or misleading empty charts.

