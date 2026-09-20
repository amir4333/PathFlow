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

### 2. Application Layer (`src/app/`)
* **Role**: Orchestrates client runtime concerns including routing, contextual providers, and app configuration.
* **Rule**: Holds application-level configuration without introducing domain logic or heavyweight global state libraries.
* **Status**: **Implemented (Foundation Shell)**. Type-safe router provider and centralized configuration are active.

### 3. Domain Layer (`src/domain/`)
* **Role**: The core business logic of PathFlow. Encapsulates entity models, validation invariants, and calculation services (e.g., progress formulas, completion velocity).
* **Rule**: Written in **pure TypeScript** with zero dependencies on React, browser DOM, or storage implementations.
* **Status**: **Implemented (Phase 2)**. Core entity models (Goal, Roadmap, Task, Session, WeeklyPlan), validation rules, lifecycle state transitions, and pure progress calculation services are established in pure TypeScript. See `docs/domain-model.md` for full specification.

### 4. Data Layer (`src/data/`)
* **Role**: Mediates data storage through the Repository pattern. Divided into `local/` (target: IndexedDB for offline persistence), `remote/` (future API client), and `repositories/` (contract interfaces).
* **Rule**: Repositories provide unified interfaces so domain logic remains agnostic to whether storage is local IndexedDB or a mock during unit tests.
* **Status**: **Conceptual Structure / Placeholder for Phase 2 & 3**.

### 5. Sync Layer (`src/sync/`)
* **Role**: Handles durable mutation queuing, background incremental delta synchronization, and conflict resolution (e.g., Last-Write-Wins / Lamport timestamps) across multiple devices.
* **Rule**: Synchronization is strictly isolated as an auxiliary concern; the application is fully functional offline even if synchronization is disabled or unavailable.
* **Status**: **Conceptual Structure / Placeholder for Phase 4**.

---

## Why These Layers Are Separated

1. **Local-First Independence**: The user can perform full workflows (plan, start sessions, track time, review) without network access. UI interacts with local repositories; synchronization happens asynchronously in the background.
2. **Determinism & Testability**: Business rules (e.g., progress calculation, capacity limits) can be thoroughly unit-tested without rendering React components or mocking DOM/databases.
3. **PWA & Storage Swappability**: Local storage implementations can evolve (e.g., migrating or wrapping IndexedDB) without modifying UI views or domain logic.
4. **Controlled Collaboration**: Teacher/mentor review sharing is an isolated consumer of progress summaries, completely partitioned from personal deep-work execution logs.

---

## Current Status vs. Future Phases

| Layer | Component | Status in Phase 1 | Planned Target Phase |
| :--- | :--- | :--- | :--- |
| **Presentation** | AppShell & Navigation | **Implemented** | Phase 1 Foundation |
| **Presentation** | Feature View Shells | **Implemented (Placeholders)** | Phase 2–4 |
| **Application** | Router & App Config | **Implemented** | Phase 1 Foundation |
| **Domain** | Models (Goals, Tasks, etc.) | **Implemented** | Phase 2 |
| **Domain** | Services & Invariant Rules | **Implemented** | Phase 2 |
| **Data** | Local IndexedDB Adapter | Conceptual Directory | Phase 2 & 3 |
| **Data** | Remote API & Repositories | Conceptual Directory | Phase 2 & 4 |
| **Sync** | Queue, Engine, Conflict | Conceptual Directory | Phase 4 |
| **Backend** | PostgreSQL & Sync Server | Conceptual Directory | Phase 4+ |
