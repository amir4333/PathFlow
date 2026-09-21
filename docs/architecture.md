# PathFlow Architectural Specification

## Overview & Principles
PathFlow is a personal, multi-device, **Offline-First** execution system designed around the core workflow pipeline:
```text
Goal → Roadmap → Task → Session → Time → Progress → Review
```

The system is governed by the core architectural tenet:
**Local-first, modular, testable, and incrementally synchronized.**

---

## Layered Architecture Overview

The system is partitioned into five distinct architectural layers:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (UI & Navigation Shell)               │
│    src/components/, src/features/                           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. Application Layer (Routing, State Coordination, Config)   │
│    src/app/                                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. Domain Layer (Entities, Pure Business Rules, Services)   │
│    src/domain/                                              │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
┌───────────────▼─────────────┐ ┌─────────────▼───────────────┐
│ 4. Data Layer               │ │ 5. Sync Layer               │
│    (Local IDB & Repos)      │ │    (Queue, Engine, Conflict)│
│    src/data/                │ │    src/sync/                │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## Layer Definitions & Responsibilities

### 1. Presentation Layer (`src/components/`, `src/features/`)
* **Role**: Renders visual views, collects user interactions, and presents domain information.
* **Rule**: React components must contain **no direct domain business algorithms** and **no direct database or network calls**. All actions delegate downward through application hooks and repositories.
* **Status**: **Implemented (Foundation Shell)**. AppShell, responsive Sidebar, Header, and placeholder views for all 8 target screens are active to verify layout and navigation.

### 2. Application Layer (`src/app/`, `src/application/`)
* **Role**: Coordinates workflows, lifecycle transitions, validation rules, and repository operations between presentation components and the domain layer. Holds service composition, typed error handling, DTO contracts, and client runtime concerns (routing and contextual providers).
* **Rule**: Decouples UI components from storage details. Validates inputs, coordinates domain rules, and persists domain aggregates via repository interfaces without introducing heavyweight external state frameworks.
* **Status**: **Implemented (Phase 7)**. Complete application service layer (`GoalService`, `RoadmapService`, `TaskService`, `SessionService`, `WeeklyPlanningService`, `ProgressService`), standardized domain error hierarchy, `ApplicationProvider` React context, and composition root factory are active. See `docs/application-layer.md` for full documentation.

### 3. Domain Layer (`src/domain/`)
* **Role**: The core business logic of PathFlow. Encapsulates entity models, validation invariants, and calculation services (e.g., progress formulas, session duration calculation, actual time aggregations, planned vs. actual comparisons).
* **Rule**: Written in **pure TypeScript** with zero dependencies on React, browser DOM, or storage implementations.
* **Status**: **Implemented (Phase 2 & Phase 4)**. Core entity models (Goal, Roadmap, Task, Session, ActiveSession, WeeklyPlan), validation rules, lifecycle state transitions, pure progress calculation services, and comprehensive time tracking aggregation services are established in pure TypeScript. See `docs/domain-model.md` and `docs/session-time-tracking.md` for full specifications.

### 4. Data Layer (`src/data/`)
* **Role**: Mediates data storage through the Repository pattern. Divided into `local/` (IndexedDB via Dexie.js for offline persistence), `remote/` (future API client), and `repositories/` (contract interfaces and local implementations).
* **Rule**: Repositories provide unified interfaces so domain logic remains agnostic to whether storage is local IndexedDB or a mock during unit tests.
* **Status**: **Implemented (Phase 3 & Phase 4)**. Local Dexie-backed database (`PathFlowDB`), repository interfaces, active session singleton tracking, and full CRUD/temporal query implementations for Goal, Roadmap, Task, Session, WeeklyPlan, and WeeklyPlanItem are active. See `docs/persistence.md` and `docs/session-time-tracking.md` for details.

### 5. Sync Layer (`src/sync/`)
* **Role**: Handles durable mutation queuing, background incremental delta synchronization, and conflict resolution (e.g., Last-Write-Wins / Lamport timestamps) across multiple devices.
* **Rule**: Synchronization is strictly isolated as an auxiliary concern; the application is fully functional offline even if synchronization is disabled or unavailable.
* **Status**: **Conceptual Structure / Placeholder for Future Phase**.

---

## Why These Layers Are Separated

1. **Local-First Independence**: The user can perform full workflows (plan, start sessions, track time, review) without network access. UI interacts with local repositories; synchronization happens asynchronously in the background.
2. **Determinism & Testability**: Business rules (e.g., progress calculation, capacity limits, session duration) can be thoroughly unit-tested without rendering React components or mocking DOM/databases.
3. **PWA & Storage Swappability**: Local storage implementations can evolve (e.g., migrating or wrapping IndexedDB) without modifying UI views or domain logic.
4. **Controlled Collaboration**: Teacher/mentor review sharing is an isolated consumer of progress summaries, completely partitioned from personal deep-work execution logs.

---

## Current Status vs. Future Phases

| Layer | Component | Status | Target Phase |
| :--- | :--- | :--- | :--- |
| **Presentation** | AppShell & Navigation | **Implemented** | Phase 1 Foundation |
| **Presentation** | Feature View Shells | **Implemented (Placeholders)** | Phase 1 & Phase 5 |
| **Application** | Router & App Config | **Implemented** | Phase 1 Foundation |
| **Application** | Application Services & Composition Root | **Implemented** | Phase 7 |
| **Domain** | Models (Goals, Tasks, etc.) | **Implemented** | Phase 2 |
| **Domain** | Services & Invariant Rules | **Implemented** | Phase 2 |
| **Domain & Data** | Session & Time Tracking Foundation | **Implemented** | Phase 4 |
| **Data** | Local IndexedDB Storage & Repositories | **Implemented** | Phase 3 & Phase 4 |
| **Data** | Remote API & Repositories | Conceptual Directory | Future Phase |
| **Sync** | Queue, Engine, Conflict | Conceptual Directory | Future Phase |
| **Backend** | PostgreSQL & Sync Server | Conceptual Directory | Future Phase |
