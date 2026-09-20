/**
 * Application configuration for PathFlow.
 * Current Phase: Phase 1 (Project Foundation)
 */

export const APP_CONFIG = {
  name: 'PathFlow',
  version: '0.1.0',
  currentPhase: 'Phase 1: Project Foundation',
  tagline: 'Personal, Offline-First Goal & Roadmap Execution System',
  coreWorkflow: [
    'Goal',
    'Roadmap',
    'Task',
    'Session',
    'Time',
    'Progress',
    'Review',
  ] as const,
  principles: [
    'Local-first architecture',
    'Modular and decoupled layers',
    'Testable domain logic',
    'Incremental synchronization',
  ] as const,
} as const;

export type AppConfig = typeof APP_CONFIG;
