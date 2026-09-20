# Domain Layer — Rules

This directory is reserved for business invariants, validation rules, and domain-level guardrails.

## Architectural Guidelines
* **Invariants**: E.g., Entity titles cannot be empty; Sessions must have a non-negative duration; Session end cannot precede start; completed Tasks must have completedAt.
* **Pure Functions**: Rules are implemented as deterministic, easily testable functions returning boolean or validation error results.
* **Implemented (Phase 2)**:
  * `validation.ts`: Explicit validation rules for `Goal`, `Roadmap`, `Task`, `Session`, and `WeeklyPlan`.
  * `taskTransitions.ts`: Controlled state transition graph and lifecycle updates for `Task`.
