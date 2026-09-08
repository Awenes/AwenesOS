# Live SharePoint Excel tracker synchronization

Status: manual-update workflow implemented; automatic SharePoint integration intentionally deferred

Trackers are live Excel workbooks stored in SharePoint and edited collaboratively. Organizational approval for a Microsoft Graph integration is unlikely, so Awenes OS does not write to these workbooks automatically. After CRM-confirmed completion it creates a durable manual-update request containing the tracker reference, suggested `Completed` status, and reviewed completion description. The user edits SharePoint and explicitly confirms the update in Awenes OS.

Example inspected read-only on 2026-09-02: `AGEGE_Bug_Tracker-1.xlsx`. It contains six worksheets. The active `Mobile Version` worksheet uses these columns:

`S/N`, `Feature ID`, `Bug Description`, `Expected Result`, `Steps to Reproduce`, `Status`, `Priority`, `Comments`, `Developer's Comment`, and `PM's Comment`.

## Required live behavior

- Connect to a configured SharePoint workbook and configured worksheet/table through an authenticated Microsoft API.
- Normalize varying worksheet column names and statuses through project configuration.
- Read stable rows from every configured worksheet without downloading and replacing the workbook.
- Import tracker rows as `captured`, unassigned candidates. They require an explicit claim and never become owned work automatically.
- Retain the workbook, worksheet/table, row identity, and last observed version for every imported candidate.
- Publish only explicitly authorized field changes, initially status and developer comment.
- Re-read or use version/ETag information before writing; detect conflicts rather than overwriting a teammate's newer edit.
- Confirm the remote cell update before recording the corresponding local transition as synchronized.
- Record read, write, conflict, and failure outcomes as events. Never silently repair or overwrite tracker history.
- Preserve local-first behavior: unavailable SharePoint access must leave a visible retryable sync state.

## Integration direction

Prefer Microsoft Graph workbook APIs with delegated organizational authentication. Configuration should identify the SharePoint/OneDrive drive item plus worksheet or table, rather than store a browser sharing URL as identity. Authentication tokens must use OS-appropriate secure storage and must never be committed to the repository.

## Existing fallback

- The current CSV adapter remains useful for offline snapshots and tests, but it does not satisfy live synchronization.
- JSON configuration maps canonical fields to one or more accepted column headings.
- Status matching is case-insensitive and supports either an include list or an exclude list.
- Stable source references (`csv:<project>:<external-id>`) make repeat imports idempotent.
- Imported issues are always `captured`, `assignedToMe: false`, and therefore require an explicit claim.
- The application already depends on a `TrackerAdapter`; the live SharePoint implementation must remain an infrastructure concern.

## Blockers before implementation

- Confirm the Microsoft Entra application/client ID and delegated permissions available to Awenes OS.
- Confirm whether each worksheet contains a formal Excel Table. Graph row operations are substantially safer with tables than with positional ranges.
- Define the exact mapping from Awenes lifecycle states to workbook `Status` values and which comment column Awenes may update.
