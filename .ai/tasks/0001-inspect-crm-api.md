# Inspect CRM API

Status: partially inspected; blocked on safe mutation-response capture

Capture request/response contracts for create task, update description, start, pause, resume, complete, and list project tasks. Record authentication, idempotency, concurrency, error, and partial-failure behavior. Do not copy secrets into the repository. Implement a real adapter only after documenting these contracts.

## Read-only discovery — 2026-09-02

Source: the signed-in `crm.skoolbod.com` project/task UI and its public production JavaScript bundle. No mutation endpoint was invoked and no credential value was read or copied.

### API client and authentication

- API origin: `https://support-app.skoolms.ng`
- Client: Axios with JSON responses returned as `response.data`.
- Authentication: `Authorization: Bearer <accessToken>`, where the browser client reads the token from its local `auth` record.
- A `401` removes the local auth record and redirects to `/login` unless already on an authentication page.
- Other non-2xx responses are rejected as Axios errors. The bundle does not define a normalized error envelope.

### Observed task routes

| Operation | Contract observed in frontend |
| --- | --- |
| List tasks | `GET /tasks` with query parameters; the project page supplies at least `project`, `workItemType: "Task"`, `page`, `limit`, `search`, `status`, `priority`, `sortBy`, `assigneeId`, `order`, and date filters when set. |
| Get task | `GET /tasks/{taskId}` |
| Create task | `POST /tasks` with a JSON task object. Observed fields include `title`, `description`, `project`, optional `assignee`, optional ISO `dueDate`, `workItemType`, `priority`, `status`, `labels`, `dependencies`, and optional `sourceBug`. |
| Update task | `PATCH /tasks/{taskId}` with a partial JSON task object. This is the route used by the frontend for task edits; description and lifecycle status are fields on the task object. |
| Delete task | `DELETE /tasks/{taskId}` (out of scope for the adapter). |
| Add comment | `POST /tasks/{taskId}/comments` with `{ "comment": string }` (out of scope). |

The project resource is `GET /projects/{projectId}`. Project listing is `GET /projects` with query parameters. The project task screen itself obtains its task collection through `GET /tasks?project={projectId}&workItemType=Task...`, not through a nested project-tasks endpoint.

### Observed task representation and lifecycle

The UI shows task identifiers (`_id` plus a display `TASK-xxxxx` suffix), `title`, `description`, `project`, `assignee`, `reporter`, `dueDate`, `priority`, `status`, `attachments`, `dependencies`, `createdAt`, `updatedAt`, and `timeSpentSeconds`. Status values visible in the signed-in project UI are `Open`, `In Progress`, `Paused`, and `Completed`.

The detail UI presents start/pause/resume/complete as lifecycle controls over the same task resource. The bundle exposes the generic `PATCH /tasks/{taskId}` update function rather than dedicated task action routes. Exact patch bodies for each transition and their response examples still require controlled mutation capture.

### Trust properties still unverified

- No idempotency key header or request field was found in the frontend client.
- No ETag, `If-Match`, version field, or other optimistic-concurrency mechanism was found.
- Retry behavior for mutations is not established; the frontend surfaces failures and does not prove server-side idempotency.
- Error response bodies, validation status codes, conflict behavior, and partial-failure semantics are not established.
- Exact response envelopes for create/update/list and exact transition payloads for start, pause, resume, and complete are not yet captured.

These gaps block a trustworthy real adapter. The next inspection should use a disposable test task (or an API sandbox) and capture one controlled request/response per lifecycle transition, including a repeated request and a stale concurrent update. Do not perform that against production work without explicit authorization.
