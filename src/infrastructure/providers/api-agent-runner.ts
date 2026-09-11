import type {
  AgentRunner,
  AgentRunRequest,
} from "../../domain/agent-runner.js";
import type { AgentToolCall, AgentToolHost } from "../../domain/agent-tools.js";
import type { SecretVault } from "../../domain/provider.js";
import type { AgentCapability } from "../../domain/agent-role.js";
type Fetch = typeof fetch;

export class ApiAgentRunner implements AgentRunner {
  constructor(
    private vault: SecretVault,
    private tools: (
      root: string,
      capabilities: AgentCapability[],
    ) => AgentToolHost,
    private request: Fetch = fetch,
  ) {}
  async run(input: AgentRunRequest) {
    if (input.provider.authMethod !== "api_key")
      throw new Error("API-key provider is not configured");
    const key = await this.vault.get(`provider:${input.provider.id}`);
    if (!key) throw new Error("Provider credential is missing");
    return input.provider.kind === "openai"
      ? this.openai(input, key)
      : this.anthropic(input, key);
  }
  private async openai(input: AgentRunRequest, key: string) {
    const deadline = Date.now() + input.timeoutSeconds * 1000;
    let items: any[] = [
      { role: "developer", content: input.instructions },
      {
        role: "user",
        content: `Task: ${input.taskTitle}\n${input.taskDescription}\nStage: ${input.stage}`,
      },
    ];
    let transcript = "";
    for (let turn = 0; turn < input.maxTurns; turn++) {
      const response = await this.json(
        "https://api.openai.com/v1/responses",
        {
          model: input.modelId,
          input: items,
          tools: definitions("openai", input.capabilities),
          store: false,
        },
        { authorization: `Bearer ${key}` },
        deadline,
      );
      const calls = (response.output ?? []).filter(
        (item: any) => item.type === "function_call",
      );
      const text =
        response.output_text ?? extractOpenAiText(response.output ?? []);
      transcript += text ? `${text}\n` : "";
      if (!calls.length)
        return { success: true, summary: text || "Agent finished", transcript };
      const outputs = await Promise.all(
        calls.map(async (call: any) => ({
          type: "function_call_output",
          call_id: call.call_id,
          output: await this.tools(
            input.worktreePath,
            input.capabilities,
          ).execute(parseCall(call.call_id, call.name, call.arguments)),
        })),
      );
      items = [...items, ...(response.output ?? []), ...outputs];
    }
    return {
      success: false,
      summary: `Agent exceeded the ${input.maxTurns}-turn tool limit`,
      transcript,
    };
  }
  private async anthropic(input: AgentRunRequest, key: string) {
    const deadline = Date.now() + input.timeoutSeconds * 1000;
    const messages: any[] = [
      {
        role: "user",
        content: `${input.instructions}\n\nTask: ${input.taskTitle}\n${input.taskDescription}\nStage: ${input.stage}`,
      },
    ];
    let transcript = "";
    for (let turn = 0; turn < input.maxTurns; turn++) {
      const response = await this.json(
        "https://api.anthropic.com/v1/messages",
        {
          model: input.modelId,
          max_tokens: 8192,
          messages,
          tools: definitions("anthropic", input.capabilities),
        },
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        deadline,
      );
      const calls = (response.content ?? []).filter(
        (item: any) => item.type === "tool_use",
      );
      const text = (response.content ?? [])
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join("\n");
      transcript += text ? `${text}\n` : "";
      if (!calls.length)
        return { success: true, summary: text || "Agent finished", transcript };
      messages.push(
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: await Promise.all(
            calls.map(async (call: any) => ({
              type: "tool_result",
              tool_use_id: call.id,
              content: await this.tools(
                input.worktreePath,
                input.capabilities,
              ).execute({
                id: call.id,
                name: call.name,
                arguments: call.input,
              }),
            })),
          ),
        },
      );
    }
    return {
      success: false,
      summary: `Agent exceeded the ${input.maxTurns}-turn tool limit`,
      transcript,
    };
  }
  private async json(
    url: string,
    body: unknown,
    headers: Record<string, string>,
    deadline: number,
  ) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Agent exceeded its time limit");
    const response = await this.request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.min(120_000, remaining)),
    });
    if (!response.ok)
      throw new Error(
        `Provider request failed (${response.status}): ${(await response.text()).slice(0, 1000)}`,
      );
    return response.json() as Promise<any>;
  }
}
function parseCall(id: string, name: AgentToolCall["name"], args: string) {
  return { id, name, arguments: JSON.parse(args) as Record<string, unknown> };
}
function extractOpenAiText(output: any[]) {
  return output
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");
}
function definitions(
  kind: "openai" | "anthropic",
  capabilities: AgentCapability[],
) {
  const tools = [
    {
      name: "list_files",
      description: "List repository files",
      input_schema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "read_file",
      description: "Read a UTF-8 file in the worktree",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "write_file",
      description: "Create or replace a UTF-8 file in the worktree",
      input_schema: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      name: "run_command",
      description: "Run an allowlisted command in the worktree",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string" },
          args: { type: "array", items: { type: "string" } },
          network: { type: "string", enum: ["none", "localhost", "public"] },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
  ]
    .filter(
      (tool) => tool.name !== "write_file" || capabilities.includes("code"),
    )
    .filter(
      (tool) =>
        tool.name !== "run_command" ||
        capabilities.some((value) =>
          ["code", "test", "review", "browser"].includes(value),
        ),
    );
  return kind === "anthropic"
    ? tools
    : tools.map(({ input_schema, ...tool }) => ({
        type: "function",
        ...tool,
        parameters: input_schema,
        strict: false,
      }));
}
