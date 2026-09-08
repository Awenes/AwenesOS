# Durable local notification centre

Status: implemented; Windows toast delivery deferred

Derive actionable reminders from trustworthy local state for CRM sync failures, prepared completions, long-paused tasks, active tasks without evidence, and pending manual SharePoint updates.

Notification occurrences use state-versioned keys. Dismiss and snooze choices are persisted and recorded as task events. Snoozing never alters task state, and resolving the underlying condition removes the reminder naturally.

The CLI notification centre is the durable source. Future Windows toast notifications must be a delivery layer over this service, not a separate source of truth.

CLI snoozing uses human-friendly relative durations (`30m`, `1h`, `1d`) rather than requiring ISO timestamps.
