# ADR 0003: Retire CRM and CSV tracker-import integrations

Status: accepted

Remove the CRM coordination workflow and the CSV tracker-import workflow, their CLI commands, application services, adapters, and how-to docs. Product direction (`.ai/context/product.md`) no longer includes CRM, SharePoint, or task-management integration in v0.1; task capture and completion are local and manual.

Existing `crm_mappings`, `tracker_updates`, and `manual_crm_updates` tables, their migrations, and the historical `NotificationKind` and task-source enum values stay in place so existing local databases keep migrating cleanly and past events remain readable. No new code path writes to them.
