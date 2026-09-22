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
    const prompt = `${input.instructions}\n\n## Assigned task\n${input.taskTitle}\n${input.taskDescription}\n\n## Stage\n${input.stage}\n${input.priorContext ? `\n${input.priorContext}\n` : ""}\nWork only inside the assigned worktree. End with a concise summary and verification evidence.`;
    const openai = input.provider.kind === "openai";
    const canWrite = input.capabilities.includes("code");
    const args = openai
      ? [
          "-c",
          "sandbox_workspace_write.network_access=true",
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
    const { summary, isError } = extractSummary(
      result.stdout,
      result.stderr,
      result.exitCode,
    );
    return {
      success: result.exitCode === 0 && !result.timedOut && !isError,
      summary,
      transcript,
    };
  }
}
function extractSummary(
  stdout: string,
  stderr: string,
  exitCode: number | null,
) {
  const trimmed = stdout.trim();
  const single = tryParseJson(trimmed);
  if (single) {
    const message = extractMessage(single);
    if (message) return { summary: message, isError: isErrorPayload(single) };
  }
  const parsedLines = trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map(tryParseJson)
    .filter((value): value is Record<string, unknown> => value !== null);
  if (parsedLines.length) {
    const message = [...parsedLines]
      .reverse()
      .map(extractMessage)
      .find((value) => value !== null);
    if (message)
      return { summary: message, isError: parsedLines.some(isErrorPayload) };
  }
  return {
    summary:
      lastMeaningfulLine(stdout) || stderr || `Agent exited with ${exitCode}`,
    isError: false,
  };
}
function tryParseJson(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
function extractMessage(value: Record<string, unknown>) {
  for (const key of ["result", "message", "summary", "text", "output"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }
  return null;
}
function isErrorPayload(value: Record<string, unknown>) {
  return value.is_error === true || value.error != null;
}
function lastMeaningfulLine(value: string) {
  return value.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "";
}
