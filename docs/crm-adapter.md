# CRM adapter investigation checklist

Before replacing the mock, inspect the authenticated browser traffic for:

- project task listing and identifiers;
- task creation and required fields;
- description update semantics;
- start, pause, resume, and completion status values;
- whether completion description belongs in description, comment, or activity;
- authentication renewal and CSRF requirements;
- idempotency or version fields;
- validation, authorization, rate-limit, and partial-failure responses.

Sanitize captured requests. Store endpoint shapes and decisions, never credentials or session tokens.
