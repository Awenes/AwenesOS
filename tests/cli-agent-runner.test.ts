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
      worktreePath: "C:\\work",
      timeoutSeconds: 60,
      maxTurns: 4,
      capabilities: ["code"],
    });
    expect(result.success).toBe(true);
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
  });
});
