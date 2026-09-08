# ADR 0002: CRM port and explicit pending sync

Status: accepted

CRM behavior is represented by an application-facing adapter. The initial implementation is a durable local mock. A task enters `sync_pending` before completion sync and becomes `completed` only after external confirmation. Failures remain visible and retryable.
