# Checkpoint 0003 — Project isolation foundation

Status: implemented and verified.

Tasks can be assigned to registered projects and queried by project. Project execution policies default to no network, filtered environment variables, an explicit command allowlist, bounded process duration, an isolated browser profile, and developer approval for Git push.

The execution guard enforces writable-worktree, command, environment, network, and push boundaries. Task worktrees use dedicated branches, live outside the normal checkout, permit one active writer per project, and retain an append-only creation/release history.

Actual model execution, command spawning, browser testing, and Git push orchestration remain later phases; those systems must consume these policy and worktree services rather than bypassing them.
