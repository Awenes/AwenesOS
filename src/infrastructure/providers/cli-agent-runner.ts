import type {
  AgentRunner,
  AgentRunRequest,
  AgentRunResult,
} from "../../domain/agent-runner.js";
import type { CommandExecutor } from "../../domain/execution.js";
export class CliAgentRunner implements AgentRunner {
  constructor(private command: CommandExecutor) {}
  async run(input: AgentRunRequest): Promise<AgentRunResult> {
    if (input.provider.authMethod !== "cli" || !input.provider.command)
      throw new Error("CLI provider is not configured");
    const prompt = `${input.instructions}\n\n## Assigned task\n${input.taskTitle}\n${input.taskDescription}\n\n## Stage\n${input.stage}\nWork only inside the assigned worktree. End with a concise summary and verification evidence.`;
    const openai = input.provider.kind === "openai";
    const canWrite = input.capabilities.includes("code");
    const args = openai
      ? [
          "exec",
          "--model",
          input.modelId,
          "--sandbox",
          canWrite ? "workspace-write" : "read-only",
          "--ephemeral",
          "--json",
          "-",
        ]
      : [
          "-p",
          "--model",
          input.modelId,
          "--output-format",
          "json",
          "--permission-mode",
          canWrite ? "acceptEdits" : "plan",
        ];
    const result = await this.command.execute({
      command: input.provider.command,
      args,
      cwd: input.worktreePath,
      network: "public",
      stdin: prompt,
      timeoutSeconds: input.timeoutSeconds,
    });
    const transcript = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n");
    return {
      success: result.exitCode === 0 && !result.timedOut,
      summary:
        lastMeaningfulLine(result.stdout) ||
        result.stderr ||
        `Agent exited with ${result.exitCode}`,
      transcript,
    };
  }
}
function lastMeaningfulLine(value: string) {
  return value.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}
