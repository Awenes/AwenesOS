# Desktop preview

Build and start the local Windows command center:

```powershell
pnpm desktop:start
```

The preview uses the existing development database at `data/awenes.db`. A packaged application will use its Windows application-data directory unless `AWENES_DB_PATH` is explicitly configured.

## Security boundary

- React runs in a sandboxed renderer without Node.js.
- Context isolation is enabled.
- The preload exposes named Awenes operations rather than raw IPC.
- Every IPC input is validated and the sender is checked.
- Navigation, new windows, and browser permission requests are denied.
- The interface loads packaged local assets through the `awenes://` protocol.
- Filesystem, Git, database, and process access stay in the desktop main process and existing infrastructure adapters.

## Available preview areas

- Overview: project and task counts plus pending manual updates.
- Projects: register local repositories and review their completion policy.
- Tasks: capture, filter, claim, start, pause, and resume work.
- Agents: inspect and enable or disable provider-neutral roles.
- Safety: inspect readiness and edit validated execution policies.

The CLI remains supported for diagnostics, imports, evidence collection, completion workflows, and automation.
