# Agent roles

Roles describe responsibility; providers supply models. Keeping those concepts separate allows the same Reviewer role, for example, to use Codex, Claude, or another future provider without changing workflow contracts.

## Built-in roles

- Senior Engineer: planning and high-risk review.
- Implementation Engineer: scoped code and test changes inside the task worktree.
- Reviewer: independent correctness and regression review.
- Tester: approved automated and browser verification.

Built-in roles have conservative capability and run limits and initially have no provider or model assigned.

## Custom role configuration

```json
{
  "projectId": null,
  "slug": "frontend-specialist",
  "name": "Frontend Specialist",
  "description": "Implements approved UI work.",
  "promptTemplate": "Implement the approved UI task inside the assigned worktree.",
  "providerId": null,
  "modelId": null,
  "capabilities": ["code", "test"],
  "limits": { "maxTurns": 25, "timeoutSeconds": 1200, "maxRetries": 1 },
  "enabled": true
}
```

Supported capabilities are `plan`, `code`, `test`, `browser`, `review`, `git_commit`, and `git_push`. Capabilities declare eligibility only; the project execution policy and approval requirements still govern every operation.
