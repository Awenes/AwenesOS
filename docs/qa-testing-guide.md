# AwenesOS v0.1 QA testing guide

## Document control

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| Product        | AwenesOS                                                                 |
| Release        | Electron `0.1.0` acceptance candidate                                    |
| Platform       | Local Windows desktop                                                    |
| Audience       | QA tester or developer performing acceptance testing                     |
| Test level     | Installation, functional, integration, safety, recovery, and exploratory |
| Exit condition | No unresolved blocker/critical defects and all mandatory scenarios pass  |

## 1. Product in plain language

AwenesOS coordinates coding-agent work for developers. A developer registers one or more local Git repositories, connects an AI provider, configures agent roles, captures a task, and starts a staged workflow. Agents work in a separate Git worktree. The developer retains control of approvals, delivery, and external CRM or SharePoint updates.

There are two related but independent lifecycles:

- A **task** represents the developer's work item and its timing/external status.
- A **run** represents one staged agent execution for that task.

A completed run does not automatically mean the external task is completed. A task remains pending until the developer confirms the manual CRM update. A bug-tracker task may also wait for SharePoint confirmation.

## 2. Scope and boundaries

Test these v0.1 capabilities:

- installation and first launch;
- multiple local projects;
- project readiness and safety policies;
- OpenAI and Anthropic provider connections;
- experimental Codex and Claude CLI connections;
- built-in agent roles and provider/model assignment;
- prompt versioning, reset, conflicts, and effective preview;
- built-in, repository, and personal skill snapshots;
- task lifecycle, duration, and manual external-update flow;
- staged workflow execution and recovery;
- role, network, worktree, command, environment, retry, turn, and timeout boundaries;
- isolated localhost browser testing and evidence;
- manual, approval-before-push, and automatic delivery policies;
- approval, failure, completion, CRM, tracker, and reminder notifications; and
- local persistence after restart.

Do not report these deliberate exclusions as defects:

- automatic CRM or SharePoint mutation;
- remote development environments;
- continued work while the PC is asleep;
- cloud synchronization or organization administration;
- Tauri packaging; and
- OS-level Windows process/network sandboxing.

## 3. Safety rules for testing

1. Use disposable local repositories and test accounts only.
2. Never register a production repository for destructive or delivery testing.
3. Do not enter production CRM, SharePoint, model-provider, or application credentials.
4. Use an empty disposable Git remote for push tests. Confirm its exact URL before approving a push.
5. Keep public-network access disabled except during provider tests that require it.
6. Do not disable push approval unless specifically executing the automatic-push scenario.
7. Record the installer checksum before testing.
8. Preserve screenshots, traces, logs, task IDs, run IDs, and timestamps for every failure.

## 4. Required test environment

### Mandatory

- Windows 10 or later
- Git available from PowerShell
- Chrome or Edge
- At least 2 GB free disk space
- Permission to install a per-user Windows application
- A disposable local Git repository

### Provider scenarios

At least one of the following is required for the end-to-end happy path:

- a restricted test OpenAI API key;
- a restricted test Anthropic API key;
- Codex CLI already installed and signed in; or
- Claude CLI already installed and signed in.

API calls can incur provider charges. Use a low-cost test model and a small task.

### Optional integration fixtures

- a disposable remote repository for push testing;
- a small localhost web application with a health endpoint;
- a sample bug-tracker CSV for CLI import coverage; and
- a mock CRM/SharePoint record that will only be updated manually.

## 5. Acceptance build

Installer:

```text
release\AwenesOS-Setup-0.1.0.exe
```

Record and verify the SHA-256 generated for the exact acceptance build:

```powershell
Get-FileHash .\release\AwenesOS-Setup-0.1.0.exe -Algorithm SHA256
```

Pass when the hash remains identical for every tester receiving that acceptance build. Stop testing and report a release-blocking issue if it changes in transit.

## 6. Create a disposable repository

The following example creates a local fixture. Do not run it inside another repository.

```powershell
New-Item -ItemType Directory C:\qa\awenes-sample
Set-Location C:\qa\awenes-sample
git init -b main
Set-Content README.md "# Awenes QA sample"
git add README.md
git commit -m "test: initial fixture"
```

Add a minimal application only if browser testing is in scope. Its start command must keep running, and its health URL must return HTTP 200.

## 7. Navigation map

| Screen        | What the tester should understand                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Overview      | Shows onboarding progress and work across all registered projects                                        |
| Projects      | Registers repositories; registration alone must not run an agent or modify Git                           |
| Tasks         | Owns the work-item lifecycle, duration, evidence, and external confirmations                             |
| Runs          | Owns staged agent activity, outputs, browser evidence, diff, commit, and push                            |
| Approvals     | Holds explicit, durable decisions before sensitive transitions                                           |
| Agents        | Configures role responsibility, model, prompt, skills, and enabled state                                 |
| Providers     | Stores and verifies model-provider connections                                                           |
| Notifications | Surfaces actionable local events and permits snooze/dismiss                                              |
| Safety        | Controls project readiness, network, commands, environment, timeouts, push approval, and browser testing |

The sidebar should remain visible at normal desktop widths. A visible error banner should appear when an action is rejected.

## 8. Test execution order

Run scenarios in the listed order because later scenarios depend on earlier configuration. Record each result as `Pass`, `Fail`, `Blocked`, or `Not applicable`.

### QA-001 — Installation and launch

Steps:

1. Run the NSIS installer.
2. Choose an installation directory.
3. Confirm Start menu and desktop shortcut creation.
4. Launch AwenesOS.
5. Close and relaunch it.

Expected:

- Installation completes without requesting Node.js, npm, or pnpm.
- The application uses the AwenesOS icon and opens the command center.
- The renderer displays no raw terminal window.
- The first-launch onboarding cards are visible.
- Relaunch succeeds and does not duplicate or corrupt initial data.

### QA-002 — Empty-state onboarding

Steps:

1. Inspect Overview before registering anything.
2. Select each onboarding card.

Expected:

- Project, active-work, CRM-update, and tracker-update counts are zero.
- Cards navigate to Projects, Providers, Agents, and Safety.
- No task or run starts automatically.

### QA-003 — Project registration and multiple projects

Steps:

1. Open Projects and select **Add project**.
2. Use **Browse** to select the disposable repository, then register it with branch `main` and policy **Preview manually**.
3. Register a second disposable repository.
4. Open Tasks and switch the project filter.

Expected:

- Both projects remain visible with distinct paths and task counts.
- The native Windows folder picker supplies the repository path; manual path typing is not required.
- No source files or branches change merely because a project was registered.
- Task filtering never mixes project-specific results.
- Restarting AwenesOS preserves both projects.

Negative checks:

- A nonexistent/unreadable path must fail clearly.
- A directory that is not a Git repository must require the tester to explicitly select **Create a local Git repository**. Without that consent, registration must stop; with it, AwenesOS may initialize Git locally and readiness may proceed.
- Invalid or empty names and branches must not be accepted.

### QA-004 — Environment readiness

Steps:

1. Open Safety and select the first project.
2. Run **Readiness check**.
3. Repeat with a deliberately invalid project fixture if available.

Expected:

- Results identify repository access, Git, Node, pnpm, worktree support, and browser availability.
- Required failed checks make the overall result not ready.
- Browser absence is reported without pretending browser verification is available.
- The readiness operation is read-only.

### QA-005 — Default safety policy

Steps:

1. Inspect a newly registered project's Safety settings.
2. Note network access, allowed commands, environment variables, timeout, and push approval.

Expected:

- Public network is disabled by default.
- Localhost is not silently treated as public network.
- Push approval is enabled by default.
- Browser profiles are always isolated.
- Policy changes remain project-specific after restart.

### QA-006 — Provider connection

Run the applicable API and/or CLI variation.

API-key variation:

1. Open Providers and add OpenAI or Anthropic.
2. Select API-key authentication, enter a test key and supported model IDs, and save.
3. Verify the connection.
4. Try an invalid key.
5. Disconnect the provider.

CLI variation:

1. Confirm Codex or Claude CLI is already signed in outside AwenesOS.
2. Add the matching provider with CLI authentication. Leave the advanced program location at its default unless Windows cannot find the installed CLI.
3. Verify the connection.
4. Repeat with a nonexistent command.

Expected:

- Valid connections become ready; invalid ones show an actionable error.
- A ready connection shows its verification time and no longer offers a redundant **Verify** button.
- Model choices use friendly names while AwenesOS retains the exact provider ID internally.
- A visible loading indicator remains present while verification is in progress.
- API keys are never displayed again in plaintext.
- Disconnect removes stored credentials and prevents new runs from using the connection.
- Existing CLI login is checked; AwenesOS does not imitate or scrape a browser login.

### QA-007 — Agent roles and models

Steps:

1. Open Agents.
2. Review Senior Engineer, Implementation Engineer, Reviewer, and Tester.
3. Assign a ready provider and a valid model to every enabled role.
4. Disable one required role and try to create a run.
5. Re-enable it and retry.

Expected:

- Each role shows its capabilities.
- Model assignment uses a provider-specific dropdown with friendly model names; users never need to type a model ID.
- Assignments persist.
- A run cannot be created when a required role is disabled.
- Review/planning roles do not receive file-write access.
- Only roles with relevant capabilities can run commands.

### QA-008 — Prompt management

Steps:

1. Select **Edit prompt** on a role.
2. Record the current version and effective-instruction hash.
3. Save an edited prompt.
4. Reopen it and verify the version increased.
5. Select **Reset to default**.
6. Add contradictory phrases such as `never push` and `git push`, then inspect warnings.

Expected:

- Saving creates a new version instead of rewriting history.
- Reset creates another version containing the role default.
- Effective preview includes prompt and attached skills.
- The content hash changes when effective instructions change.
- Conflict warnings are visible.
- A run already created retains its earlier instruction snapshot.

### QA-009 — Skill snapshots and permissions

Steps:

1. Open Agents and select **Local skill**.
2. Create a personal skill with a unique slug/version and harmless instruction.
3. Attempt to save/attach without checking the permission-review box.
4. Save after reviewing exact content and permissions.
5. Create a repository-scoped skill attached to one project.
6. Attach and detach skills from a role.

Expected:

- Unreviewed skills cannot be attached.
- Built-in, personal, and repository sources are distinguishable.
- Repository skills are offered only in the appropriate project context.
- The effective preview includes skill name, version, content hash, and content.
- Editing/recreating content produces a new immutable snapshot; existing runs do not change.
- Skill permissions never override project network policy, role capabilities, or push approval.

### QA-010 — Task capture and lifecycle

Steps:

1. Open Tasks and capture a manual task assigned to the first project.
2. Claim it, start it, pause it, wait briefly, and resume it.
3. Open Details after each transition.
4. Prepare a completion description.
5. Finish locally.

Expected:

- Legal controls appear for the current state only.
- The task follows `captured → planned → in_progress → paused → in_progress → ready_to_complete → sync_pending`.
- Active, paused, and elapsed durations are plausible and never negative.
- Finishing locally does not claim the CRM was updated.
- A manual CRM instruction and notification appear.

### QA-011 — Manual CRM and SharePoint confirmation

Steps:

1. With a task in `sync_pending`, inspect its Details and Notifications.
2. Pretend to apply the requested update in a disposable external record.
3. Select **I updated CRM** only after that step.
4. For a bug-tracker-origin task, confirm the separate SharePoint tracker instruction from Details.

Expected:

- The task does not reach `completed` before CRM confirmation.
- Confirmation records an event and removes the pending CRM notification.
- Bug-tracker work creates a separate tracker reminder.
- A tracker confirmation fails when no matching pending tracker update exists.
- AwenesOS never opens or mutates the live CRM/SharePoint service itself.

### QA-012 — Run creation and start approval

Steps:

1. Create a run for an eligible project task.
2. Open Approvals and inspect the start request.
3. Reject one test run.
4. Create another run and approve it.
5. Open Runs and inspect all five stages.

Expected:

- The exact prompt versions, skill versions/hashes, roles, and permissions are snapshotted.
- Rejection cancels the run and is retained in history.
- Approval moves the run to planning.
- The stages are Plan, Implement, Review, Test, and Delivery.

### QA-013 — Staged agent execution

Precondition: grant public network and allow the provider command when needed.

Steps:

1. Select **Run next stage** for Plan.
2. Repeat for Implement, Review, and Test.
3. Inspect output and attempt counts after each stage.
4. Remove public-network permission and attempt a new provider stage.

Expected:

- Each stage uses its assigned role/provider/model and the task worktree.
- A pending stage is labelled **Ready**. Only an actively executing stage is labelled **Running**, with elapsed time visible.
- Outputs and attempts persist in the run inspector.
- Provider traffic is denied without explicit public-network permission.
- The normal repository checkout remains unchanged during agent execution.
- Agent work appears only in the dedicated task worktree.

### QA-014 — Retry, turn limit, timeout, pause, and cancellation

Steps:

1. Configure a harmless failure, such as an allowed command that exits nonzero.
2. Run the stage, inspect failure evidence, resume, and retry.
3. Exercise Pause and Resume between stages.
4. Exercise Cancel on another disposable run.
5. Configure a short safe timeout and a command that exceeds it.

Expected:

- Attempts increment and stop after the role's retry limit.
- Agent tool loops stop at the configured turn limit.
- Long processes are terminated at the lower applicable timeout.
- Child processes are cleaned up.
- Paused/cancelled runs do not continue silently.

### QA-015 — Crash and restart recovery

Steps:

1. Start a deliberately long-running disposable stage.
2. Force-close AwenesOS while the stage is running.
3. Relaunch AwenesOS.

Expected:

- The interrupted run is recovered as paused.
- The in-flight step is marked failed with an interruption explanation.
- A recovery event is appended; history is not silently rewritten.
- The tester can inspect and deliberately resume the run.

### QA-016 — Localhost browser configuration

Steps:

1. Set the project network policy to **Localhost only** and save it.
2. In Safety, enter an explicit localhost base URL and same-origin health URL.
3. Enter the start command/arguments and installed Chrome or Edge executable.
4. Optionally enter disposable test credential name/value.
5. Save the browser configuration.

Expected:

- Non-localhost URLs are rejected.
- Base and health URLs must have the same origin.
- Credentials are not redisplayed in plaintext.
- Public-network permission is not required for this localhost-only test.

The v0.1 graphical form configures an HTTP-200 smoke assertion. The underlying engine also supports fill, click, keypress, wait, visible-text/URL/status assertions, and optional setup/cleanup commands; those advanced definitions are covered by automated tests but are not individually editable in the current desktop form.

### QA-017 — Browser run and evidence

Steps:

1. Ensure the configured local application is stopped.
2. Open the task run and select **Run browser test**.
3. Inspect the resulting browser evidence.
4. Repeat with an invalid health URL or failing page.

Expected:

- AwenesOS starts the configured server and waits for health.
- Chrome/Edge uses a disposable profile, not the tester's normal profile.
- The configured assertion result, screenshot, trace, console errors, and failed requests are persisted.
- Setup/start/cleanup processes use the project allowlist and localhost intent.
- Failure evidence remains inspectable and the server/profile are cleaned up.

### QA-018 — Git review and manual delivery

Steps:

1. Use a project configured as **Preview manually**.
2. Run through Delivery.
3. Select **Review diff**.
4. Attempt **Commit** and **Push after approval**.
5. Approve the manual completion request.

Expected:

- Diff/status/stat refer to the task worktree and branch.
- AwenesOS refuses to commit or push under manual delivery.
- Approving manual completion closes the run without pushing.
- The developer can inspect and deliver changes independently.

### QA-019 — Approval-before-push delivery

Steps:

1. Use a disposable project configured as **Approve before push**.
2. Complete all agent stages.
3. Inspect the diff before deciding the push request.
4. Reject the first request and confirm no push occurred.
5. Repeat with a fresh run and approve.

Expected:

- Push cannot happen from a renderer-supplied flag or without a stored approval.
- Rejection is durable and no remote branch appears.
- Approval causes the trusted process to commit and push the exact task branch.
- Commit SHA, remote, and push event are recorded.
- The workflow run becomes completed.

### QA-020 — Automatic-push policy

Steps:

1. Use a disposable project and remote only.
2. Select **Automatic push**.
3. With **Require developer approval before Git push** enabled, complete a run.
4. Confirm a push approval is still required.
5. Disable push approval deliberately, save, and complete a second disposable run.

Expected:

- The safety requirement overrides automatic delivery while approval is enabled.
- With approval explicitly disabled, delivery commits and pushes without another prompt.
- Automatic push never targets a branch or remote other than the recorded worktree branch and configured `origin`.

### QA-021 — Notifications

Generate and inspect each applicable notification:

- run awaiting approval;
- failed run;
- completed run;
- completion ready;
- manual CRM update pending;
- SharePoint tracker update pending;
- long-paused task; and
- active task with no evidence.

Expected:

- Action/critical items appear in the Notification centre and as supported Windows notifications.
- Selecting **Snooze 1h** hides the current occurrence temporarily.
- Selecting **Dismiss** hides that occurrence and records the action.
- Resolving the underlying condition removes the notification.
- Clicking a Windows notification focuses AwenesOS.

### QA-022 — Persistence and data separation

Steps:

1. Record projects, tasks, roles, prompt versions, skills, runs, approvals, and notifications.
2. Restart the application.
3. Inspect all screens again.

Expected:

- Product state persists locally.
- API keys and browser credentials are not present as plaintext in the SQLite database.
- One project's policy, tasks, worktree, skills, and browser settings do not leak into another project.

### QA-023 — Renderer security checks

Expected by inspection/exploratory testing:

- External navigation and popup windows are denied.
- Browser permission prompts are denied.
- The UI cannot access arbitrary Node.js APIs.
- Invalid IPC-shaped input is rejected by boundary validation.
- File operations cannot escape the assigned worktree through `..` or absolute paths.

### QA-024 — Uninstall

Steps:

1. Close AwenesOS.
2. Uninstall it through Windows Settings.
3. Confirm shortcuts and installed application files are removed.

Expected:

- Uninstall completes cleanly.
- Report whether user data remains. Do not delete retained data manually until it has been captured as evidence.

## 9. Automated regression suite

For source-based QA, run from the repository root:

```powershell
pnpm check
pnpm test
pnpm build
```

Expected baseline for this acceptance candidate:

- type checks pass;
- 23 test files pass;
- 49 tests pass;
- the real Chrome test runs when Chrome is installed; and
- the real Git integration test creates, commits, and pushes only inside temporary fixtures.

If a test is skipped, record its name and environmental reason. A skipped mandatory scenario is not a pass.

## 10. Evidence to capture

For every scenario, record:

- test case ID;
- tester and date/time;
- Windows version;
- AwenesOS version and installer hash;
- provider/auth variation without exposing secrets;
- project delivery and safety policy;
- task/run identifier;
- actual result;
- screenshot or trace path where relevant; and
- Pass, Fail, Blocked, or Not applicable.

Redact API keys, passwords, access tokens, repository secrets, and personal data.

## 11. Defect severity

| Severity | Definition                                                                                           | Examples                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Blocker  | Prevents acceptance testing or risks uncontrolled external mutation                                  | Installer cannot launch; pushes without approval; writes outside worktree |
| Critical | Data loss, credential exposure, broken completion invariant, or repeatable security-boundary failure | Plaintext API key; task completes before CRM confirmation; policy bypass  |
| Major    | Core workflow cannot complete but a safe workaround exists                                           | Run cannot resume; browser evidence never saves; provider cannot verify   |
| Minor    | Localized UX/content defect with no integrity impact                                                 | Misleading label, layout clipping, unclear empty state                    |

## 12. Defect report template

```text
Title:
Severity:
Test case:
Build/version:
Windows version:
Preconditions:
Project policy:
Provider/auth method:

Steps to reproduce:
1.
2.
3.

Expected result:
Actual result:
Frequency:
Task ID:
Run ID:
Evidence paths/attachments:
Security or data-integrity impact:
Workaround:
```

## 13. Release sign-off

The Electron v0.1 release can proceed to the Tauri migration only when:

- every mandatory test case has an explicit result;
- no blocker or critical defect remains open;
- all failed automated checks are resolved or formally accepted;
- the manual CRM/SharePoint boundary is confirmed;
- the worktree and push-approval protections pass on a disposable repository;
- the tester confirms no normal browser profile was used;
- installation, restart recovery, persistence, and uninstall pass; and
- the QA tester and product owner record approval.
