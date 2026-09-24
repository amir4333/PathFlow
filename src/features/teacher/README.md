# Teacher View & Drill-Down (Phase 12A & 12B)

## Overview
Teacher View provides a dedicated, strictly **read-only** observation and reporting interface designed for professors, academic advisors, and supervisors to inspect a student's project progress without operational noise or accidental modifications.

---

## Key Capabilities

### 1. High-Level Teacher Overview (`#teacher-view`)
- **Factual Summary Metrics**: Displays active goals, active roadmaps, tasks worked on, completed tasks, planned time, actual recorded time, total sessions, and weekly commitments.
- **Review Period Selection**: Synchronously inspects progress across **This Week**, **Last Week**, or **Custom Range**.
- **Goal & Roadmap Hierarchy**: High-level progress bars, completion metrics, and roadmap counts.
- **Task Progress Table**: Compact list of tasks in the review period with filter pills (*All*, *Worked On*, *Completed*, *In Progress*).
- **Weekly Planning Summary**: Factual breakdown of dated vs. flexible commitments and active days.
- **Recent Recorded Work**: Historical session logs showing dates, durations, task/roadmap associations, and notes.

---

### 2. Goal Drill-Down (`#teacher-view/goal/:goalId`)
Accessible via direct navigation or clicking "View Goal Details" from any Goal in the overview.
- **Goal Metadata**: Title, description, and status.
- **Overall vs. Selected-Period Distinction**:
  - **Lifetime Progress**: Aggregates all work ever performed toward this goal (all-time task completion %, total estimated time, total actual session time, total sessions).
  - **Selected-Period Activity**: Isolates work, planned commitments, and actual sessions belonging to this goal that occurred strictly inside the chosen review period.
- **Goal Roadmap Breakdown**: Lists all child roadmaps with progress percentages, task counts, and direct links to drill down further.
- **Historical Progress Charts**: Reuses deterministic Phase 11B visualizations (Planned vs. Actual Daily, Actual Time Trend, Task Completion Trend) scoped specifically to this goal.
- **Activity Timeline**: Chronological event stream (newest first) reconstructing task completions and recorded sessions for this goal.

---

### 3. Roadmap Drill-Down (`#teacher-view/roadmap/:roadmapId`)
Accessible via direct navigation, from Goal Detail, or from the main overview.
- **Roadmap Metadata & Breadcrumbs**: Displays roadmap title with clickable link back to its parent Goal.
- **Overall vs. Selected-Period Distinction**: Compares lifetime completion against selected-period focus time.
- **Task History**:
  - Full table of tasks under this roadmap with status, priority, estimated duration, actual recorded duration, completion date, and session count.
  - Expandable task rows revealing task descriptions and individual session records (read-only).
- **Historical Progress Charts**: Roadmap-specific daily breakdown and trend charts.
- **Activity Timeline**: Chronological event stream of sessions and completed tasks under this roadmap.

---

### 4. Strict Read-Only Boundary
The Teacher View strictly isolates data observation from data mutation:
- **No Mutation Controls**: No Create, Edit, Delete, Start Session, Stop Session, Inline Task Completion Toggle, or Weekly Plan editing.
- **Read-Only Banner**: Persistent indicator clarifying that the portal is purely observational.
- **Non-Destructive Derivation**: Progress and metrics are computed dynamically on-demand from primary domain entities via `ApplicationServices` and `ProgressService`.

---

### 5. Multi-Language & Dual Calendar Support
- **Full Bilingual Support**: English (`en`) and Persian (`fa`) translations for all headers, labels, metrics, and empty states.
- **Dual-Calendar Formatting**: Operates seamlessly across Gregorian and Persian (Jalali) calendars according to user preferences, while internal timestamps remain strictly ISO 8601 UTC.
- **Offline First**: Fully functional offline backed by local IndexedDB repositories.
