# Task-to-repository mapping

Status: implemented

Explicitly attach one validated local Git repository to planned or active work. Store its canonical root, current branch, and HEAD at mapping time. Git evidence collection uses this mapping by default.

Trust rules:

- Mapping is explicit and never inferred from the current working directory.
- Validate through read-only Git commands before persistence.
- Remapping is allowed but must append a `task.repository_remapped` event.
- Store repository identity metadata, never credentials, remotes, environment variables, or file contents.
- A one-time evidence path override does not silently replace the saved mapping.
- Missing, moved, or invalid repositories fail visibly.
