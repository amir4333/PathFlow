# Domain Layer — Rules

This directory is reserved for business invariants, validation rules, and domain-level guardrails.

## Architectural Guidelines
* **Invariants**: E.g., Tasks must belong to a valid Roadmap milestone; Sessions must have a non-negative duration; Weekly Plan allocation cannot exceed capacity.
* **Pure Functions**: Rules are implemented as deterministic, easily testable functions returning boolean or validation error results.
* **Scheduled**: Will be populated in Phase 2 during domain modeling.
