# Platform foundation

Status: implemented

Establish the user-agnostic, multi-project foundation before introducing the desktop dashboard.

The first implementation slice will add:

- a project registry for multiple local repositories;
- environment-readiness checks for Git, Node.js, pnpm, repository access, and worktree support;
- explicit per-project execution and completion policies;
- domain and application interfaces that remain independent of the future desktop UI;
- append-only events and tests for every project-state change.

The desktop command center will consume these application services later. It must not become the owner of project, task, provider, permission, or run policy.

Remote workers, unattended execution while the PC sleeps, production CRM mutation, and remote development environments remain outside this slice.

Implemented with a versioned database migration, project domain/application services, a local environment inspector, CLI commands, and integration tests.
