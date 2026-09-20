# Domain Layer — Services

This directory is reserved for domain business services that orchestrate operations across multiple domain models.

## Architectural Guidelines
* **Stateless Operations**: Domain services perform business operations without directly managing UI or persistence state.
* **Phase 2+ Scope**: Calculation routines, workflow step transitions, and complex domain operations will be placed here.
* **Decoupling**: Kept strictly independent from React components and network adapters.
