/**
 * Route definitions and metadata for PathFlow navigation shell.
 * Strict typing without premature domain models.
 */

export type AppRouteId =
  | 'dashboard'
  | 'goals'
  | 'roadmaps'
  | 'tasks'
  | 'sessions'
  | 'weekly-plans'
  | 'progress'
  | 'teacher'
  | 'teacher-view'
  | 'settings';

export interface RouteDefinition {
  id: AppRouteId;
  label: string;
  description: string;
  plannedPhase: string;
  category: 'core' | 'workflow' | 'collaboration';
}

export const APP_ROUTES: RouteDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'System overview, status, and rapid navigation shell.',
    plannedPhase: 'Phase 1 (Foundation) & Phase 2+ (Aggregated Metrics)',
    category: 'core',
  },
  {
    id: 'goals',
    label: 'Goals',
    description: 'High-level multi-year & annual objectives and desired outcomes.',
    plannedPhase: 'Phase 2 (Data Modeling & Domain Logic)',
    category: 'workflow',
  },
  {
    id: 'roadmaps',
    label: 'Roadmaps',
    description: 'Decomposed milestone sequences and strategic pathways toward goals.',
    plannedPhase: 'Phase 2 (Data Modeling & Domain Logic)',
    category: 'workflow',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Actionable work units mapped directly to roadmap milestones.',
    plannedPhase: 'Phase 2 (Data Modeling & Domain Logic)',
    category: 'workflow',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    description: 'Focused deep-work execution sessions and active time tracking.',
    plannedPhase: 'Phase 3 (Work Sessions & Time Engine)',
    category: 'workflow',
  },
  {
    id: 'weekly-plans',
    label: 'Weekly Plan',
    description: 'Tactical scheduling, capacity allocation, and weekly commitments.',
    plannedPhase: 'Phase 3 (Planning & Allocation)',
    category: 'workflow',
  },
  {
    id: 'progress',
    label: 'Progress',
    description: 'Deterministic velocity calculation, completion ratios, and historical trends.',
    plannedPhase: 'Phase 3 (Progress Engine)',
    category: 'workflow',
  },
  {
    id: 'teacher-view',
    label: 'Teacher View',
    description: 'Controlled read-only progress sharing and mentor review portal.',
    plannedPhase: 'Phase 12A (Teacher View Foundation)',
    category: 'collaboration',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Language, calendar system, and presentation preferences.',
    plannedPhase: 'Cross-Cutting',
    category: 'core',
  },
];
