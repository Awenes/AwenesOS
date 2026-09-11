# Checkpoint 0004 — Agent and role configuration

Status: implemented and verified.

Awenes now has a provider-neutral role registry with built-in Senior Engineer, Implementation Engineer, Reviewer, and Tester roles. Roles own responsibilities, prompt templates, capabilities, limits, enabled state, and optional provider/model assignments.

Roles may be global or project-specific. Built-in seeding is idempotent, configuration changes are recorded as append-only role events, and assigning a provider without a model (or the reverse) is rejected.

No provider is called in this phase. Authentication, provider adapters, prompt versioning, skill assignment, and workflow execution remain separate later phases.
