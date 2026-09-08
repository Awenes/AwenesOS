# Automatic Git evidence collection

Status: implemented

Collect read-only Git metadata for active or paused tasks from a user-selected local repository. The infrastructure adapter records commit hashes/messages and changed file paths since the task's first recorded start event.

Trust rules:

- Git is an infrastructure dependency; domain and application workflow remain independent of the Git executable.
- Never read or store changed file contents, credentials, remotes, or environment variables.
- Never modify the repository, index, branch, or working tree.
- Commits and files are evidence candidates, not proof that work is complete.
- Repeated collection is idempotent for identical evidence values.
- Collection is allowed only while a task is active or paused and always uses its recorded start time.
