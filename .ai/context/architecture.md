# Architecture context

The dependency direction is `CLI/Desktop → application → domain`; infrastructure implements persistence, Git, environment, provider, execution, and browser ports used by application services.

- Domain: vocabulary, schemas, and legal lifecycle transitions.
- Application: use-case orchestration and trust rules.
- Infrastructure: SQLite/Drizzle repositories plus replaceable Git, provider, execution, and browser adapters.
- CLI: terminal input/output only.
- Desktop: sandboxed React renderer → narrow validated IPC bridge → application services. The renderer never imports infrastructure or accesses Node.js directly.

SQLite is upgraded through ordered, versioned migrations at startup. Drizzle owns typed queries and schema declarations.

Agent runs may automatically grant the provider network and executable access declared by a project's execution policy. This does not bypass separate Git push approval. Task completion is local and no CRM, SharePoint, or task-management update is queued.
