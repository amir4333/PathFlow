# Domain Layer — Services

This directory is reserved for domain business services that orchestrate operations across multiple domain models.

## Architectural Guidelines
* **Stateless Operations**: Domain services perform business operations without directly managing UI or persistence state.
* **Implemented (Phase 2)**:
  * `progressCalculator.ts`: Pure, deterministic calculation functions deriving progress metrics from source data:
    * `calculateTaskProgress`
    * `calculateSessionProgress`
    * `calculateWeeklyPlanProgress`
    * `calculateRoadmapProgress`
    * `calculateGoalProgress`
* **Decoupling**: Kept strictly independent from React components and network adapters. No mutable progress entities stored permanently.
