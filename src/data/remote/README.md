# Data Layer — Remote

This directory will contain remote API clients, DTOs, and transport adapters.

## Architectural Guidelines
* **Decoupled Transport**: Handles HTTP / WebSocket communications with the backend sync service.
* **DTO Mapping**: Converts remote wire payloads into domain entities and local storage formats.
* **Resilience**: Manages network retry logic, exponential backoff, and offline awareness.
* **Phase Status**: Placeholder for future backend synchronization phases.
