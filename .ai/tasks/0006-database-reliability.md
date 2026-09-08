# Versioned database migrations and diagnostics

Status: implemented

Replace startup schema DDL with an ordered migration ledger. Existing file databases receive a checkpointed backup before pending migrations; new and in-memory databases migrate directly. Migration statements and their ledger record execute transactionally.

Add read-only integrity diagnostics and explicit backups. Never report a database as healthy unless `PRAGMA integrity_check` passes, no foreign-key violations exist, and the applied version matches the packaged version.

Future reliability work: restore command with explicit destructive confirmation, packaged migration fixtures for every released schema, interrupted-migration fault injection, and export formats independent of SQLite.
