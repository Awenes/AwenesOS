import { describe, expect, it } from "vitest";
import { CliAgentRunner } from "../src/infrastructure/providers/cli-agent-runner.js";
import type {
  CommandExecutor,
  ExecutionRequest,
} from "../src/domain/execution.js";
describe("CliAgentRunner", () => {
  it("invokes Codex non-interactively inside the worktree", async () => {
    let seen: ExecutionRequest | undefined;
    const executor: CommandExecutor = {
      execute: async (input) => {
        seen = input;
        return {
          exitCode: 0,
          stdout: '{"type":"result","message":"Done"}',
          stderr: "",
          timedOut: false,
          startedAt: new Date(),
          completedAt: new Date(),
        };
      },
    };
    const result = await new CliAgentRunner(executor).run({
      provider: {
        id: "p",
        name: "Codex",
        kind: "openai",
        authMethod: "cli",
        command: "codex",
        models: ["model"],
        status: "ready",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastCheckedAt: new Date(),
      },
      modelId: "model",
      instructions: "Implement",
      taskTitle: "Fix",
      taskDescription: "Bug",
      stage: "implement",
      priorContext: "## Approved plan (v1)\nAdd a null check.",
      worktreePath: "C:\\work",
      timeoutSeconds: 60,
      maxTurns: 4,
      capabilities: ["code"],
    });
    expect(result.success).toBe(true);
    expect(result.summary).toBe("Done");
    expect(seen).toMatchObject({
      command: "codex",
      cwd: "C:\\work",
      network: "public",
      timeoutSeconds: 60,
    });
    expect(seen?.args).toContain("workspace-write");
    expect(seen?.args).toContain(
      "sandbox_workspace_write.network_access=true",
    );
    expect(seen?.stdin).toContain("Assigned task");
    expect(seen?.stdin).toContain("Approved plan");
  });
  it("extracts the result message from pretty-printed JSON output instead of a stray brace", async () => {
    const executor: CommandExecutor = {
      execute: async () => ({
        exitCode: 0,
        stdout:
          '{\n  "type": "result",\n  "result": "Added retry handling and updated tests"\n}',
        stderr: "",
        timedOut: false,
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    };
    const result = await new CliAgentRunner(executor).run({
      provider: {
        id: "p",
        name: "Claude",
        kind: "anthropic",
        authMethod: "cli",
        command: "claude",
        models: ["model"],
        status: "ready",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastCheckedAt: new Date(),
      },
      modelId: "model",
      instructions: "Implement",
      taskTitle: "Fix",
      taskDescription: "Bug",
      stage: "implement",
      priorContext: "",
      worktreePath: "C:\\work",
      timeoutSeconds: 60,
      maxTurns: 4,
      capabilities: ["code"],
    });
    expect(result.summary).toBe("Added retry handling and updated tests");
  });
  it("extracts the final message from JSON-lines output and treats a reported error as failure", async () => {
    const executor: CommandExecutor = {
      execute: async () => ({
        exitCode: 0,
        stdout: [
          '{"type":"task_started"}',
          '{"type":"agent_message","message":"Could not apply the patch"}',
          '{"type":"task_complete","is_error":true}',
        ].join("\n"),
        stderr: "",
        timedOut: false,
        startedAt: new Date(),
        completedAt: new Date(),
      }),
    };
    const result = await new CliAgentRunner(executor).run({
      provider: {
        id: "p",
        name: "Codex",
        kind: "openai",
        authMethod: "cli",
        command: "codex",
        models: ["model"],
        status: "ready",
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastCheckedAt: new Date(),
      },
      modelId: "model",
      instructions: "Implement",
      taskTitle: "Fix",
      taskDescription: "Bug",
      stage: "implement",
      priorContext: "",
      worktreePath: "C:\\work",
      timeoutSeconds: 60,
      maxTurns: 4,
      capabilities: ["code"],
    });
    expect(result.success).toBe(false);
  });
});
