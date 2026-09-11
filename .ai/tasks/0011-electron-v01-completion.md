# Electron v0.1 completion

Status: implementation complete; awaiting developer acceptance test

Finish the local-first desktop product before the developer acceptance test and later Tauri migration.

## Delivery checkpoints

1. Provider connections: OpenAI and Anthropic API keys, plus experimental Codex and Claude CLI connections that reuse those tools' own supported login flows.
2. Prompt and skill studio: versioned role prompts, effective-instruction preview, conflict warnings, reviewed local skill snapshots, and no automatic updates.
3. Durable workflow runs: plan, implement, review, test, and delivery stages with retries, limits, evidence, interruption, and approval gates.
4. Isolated execution: dedicated worktrees, scoped writes, filtered environment, command allowlist, timeout and child cleanup, and separately granted localhost/public network intent.
5. Browser verification: isolated profile, explicit start/health URLs and credentials, assertions, screenshots, traces, console errors, failed requests, setup, and cleanup.
6. Git delivery: diff review, commit support, completion-policy enforcement, and explicit push approval.
7. Product shell: onboarding, projects, tasks, runs, approvals, notifications, settings, recovery, and Windows packaging.

Automatic CRM/SharePoint mutation, remote development environments, unattended work while the PC sleeps, and the Tauri migration remain outside v0.1.

No phase may claim an OS-level security guarantee that the Windows implementation does not enforce. Unsupported controls must fail readiness or require explicit developer acknowledgement.
