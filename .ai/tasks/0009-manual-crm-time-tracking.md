# Manual CRM coordination and local time tracking

Status: implemented

Production use no longer calls CRM mutation endpoints. Start, pause, and resume are recorded locally immediately and create a superseding manual CRM instruction. Preparing and finalizing work creates a required `Completed` instruction containing the reviewed completion description. The task remains `sync_pending` until the user verifies the CRM and explicitly confirms it in Awenes.

Task durations are projections of append-only lifecycle events: start/resume open active intervals, pause closes them, and completion preparation closes the final active or paused interval. Reports expose active, paused, calendar duration, session count, and whether timing is currently running.

Automatic CRM coordination remains available only as an isolated mode for adapter contract tests. The production CLI uses `ManualCrmAdapter`, whose mutation methods always fail if called.
