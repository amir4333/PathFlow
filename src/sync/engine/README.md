# Sync Layer — Engine

This directory will coordinate background synchronization between local storage and the remote backend.

## Architectural Guidelines
* **Incremental Synchronization**: Exchanges only deltas / changesets since the last known sync vector or timestamp.
* **Non-Blocking Execution**: Operates in web workers or background micro-tasks without freezing the UI thread.
* **Event Reporting**: Publishes sync status events (e.g., `Idle`, `Syncing`, `Offline`, `Error`) consumed by UI indicators.
* **Phase Status**: Placeholder for synchronization phase.
