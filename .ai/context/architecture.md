# Architecture context

The dependency direction is `CLI → application → domain`; infrastructure implements persistence and CRM ports used by application services.

- Domain: vocabulary, schemas, legal lifecycle transitions, CRM port.
- Application: use-case orchestration and trust rules.
- Infrastructure: SQLite/Drizzle repository and replaceable CRM adapters.
- CLI: input/output only.

SQLite is upgraded through ordered, versioned migrations at startup. Drizzle owns typed queries and schema declarations.

Automatic adapters perform external operations before local execution-state transitions. Production v0.1 uses manual CRM coordination: execution transitions locally and emits a superseding instruction for the user. Completion enters `sync_pending` and reaches `completed` only after the user confirms the external CRM update.
