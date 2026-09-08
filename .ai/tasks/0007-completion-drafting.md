# Deterministic completion drafting

Status: implemented

Generate a structured editable completion draft from the task title, assignment, source reference, repository context, commits, files, tests, builds, notes, and links. The formatter is deterministic, local, and independent of any AI provider.

Drafting never changes task state. Preparing completion saves the reviewed custom note or current deterministic draft and then transitions to `ready_to_complete`. Evidence-free drafts explicitly warn that review and expansion are required. No evidence item is converted into a stronger claim than the user recorded.
