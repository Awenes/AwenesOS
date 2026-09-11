# Electron v0.1 acceptance candidate

Status: implementation and automated verification complete; physical developer acceptance test pending

## Completion evidence

| Requirement | Implemented evidence | Verification evidence |
| --- | --- | --- |
| OpenAI and Anthropic connections | Provider-neutral repository/service, encrypted Electron vault, API-key verification, Codex/Claude CLI probes and runners | Provider service and API/CLI runner tests |
| Prompts and skills | Prompt history/reset, effective preview and hash, conflict warnings, built-in/personal/repository immutable skill snapshots, reviewed permissions | Instruction service tests and desktop type check |
| Durable workflows | SQLite runs, stages, steps, exact instruction snapshots, retries, role turn/time limits, approvals, pause/resume/cancel, startup recovery and append-only events | Workflow service, engine and recovery tests |
| Isolated execution | One task worktree per project, constrained file host, role capability enforcement, command/environment allowlists, network intent, process timeout and child cleanup | Platform, execution-guard and worktree-tool-host tests |
| Browser verification | Localhost-only base/health URL, isolated profile, encrypted credentials, setup/start/cleanup, assertions, screenshots, traces, console and failed-request capture | Real installed-Chrome integration test |
| Git delivery | Review/diff, commit, manual/approval/automatic policies, trusted-process durable push approval check | Git delivery service test and real temporary-remote integration test |
| Desktop product shell | Onboarding, projects, tasks and timing, runs, approvals, agents, providers, notifications, safety/settings, error surfacing and recovery | Renderer/main/preload type checks and packaged startup capture |
| Windows packaging | NSIS installer, embedded Electron runtime, branded icon, native dependencies and packaged Playwright runtime | Installer build plus explicit `app.asar` dependency inspection |

Automated release gate on 2026-09-11: `pnpm check`, 49 tests across 23 files, and `pnpm build` passed. The acceptance installer is `release/AwenesOS-Setup-0.1.0.exe`, 119,127,148 bytes, SHA-256 `86B086500F5C068278EE042C75C3E5EDCBD9AD63BE288F9F00E8FFAD37D4BD25`.

## Physical acceptance test

1. Install and launch AwenesOS from the generated NSIS installer.
2. Register a disposable local Git repository and confirm its readiness report.
3. Connect one available provider and assign models to the enabled roles.
4. Review/reset a prompt, attach a reviewed skill, and inspect the effective instruction snapshot.
5. Capture and claim a task, approve its run, and execute all stages.
6. If the project exposes localhost, run the configured browser assertions and inspect the screenshot/trace evidence.
7. Exercise the selected manual, approve-push, or automatic delivery policy on a disposable remote.
8. Confirm the manual CRM/SharePoint update and verify the task timing, notification and final state.

## Preserved exclusions

Automatic CRM/SharePoint mutation, remote development environments, unattended execution while the PC sleeps, and Tauri are not included. Windows command and network restrictions are Awenes tool-boundary controls and are not represented as an OS sandbox.
