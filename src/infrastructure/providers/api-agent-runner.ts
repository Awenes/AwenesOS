import type {
  AgentRunner,
  AgentRunRequest,
} from "../../domain/agent-runner.js";
import type { AgentToolCall, AgentToolHost } from "../../domain/agent-tools.js";
import type { SecretVault } from "../../domain/provider.js";
type Fetch = typeof fetch;

export class ApiAgentRunner implements AgentRunner {
  constructor(
    private vault: SecretVault,
    private tools: (root: string) => AgentToolHost,
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
    let items: any[] = [
      { role: "developer", content: input.instructions },
      {
        role: "user",
        content: `Task: ${input.taskTitle}\n${input.taskDescription}\nStage: ${input.stage}`,
      },
    ];
    let transcript = "";
    for (let turn = 0; turn < 50; turn++) {
      const response = await this.json(
        "https://api.openai.com/v1/responses",
        {
          model: input.modelId,
          input: items,
          tools: definitions("openai"),
          store: false,
        },
        { authorization: `Bearer ${key}` },
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
          output: await this.tools(input.worktreePath).execute(
            parseCall(call.call_id, call.name, call.arguments),
          ),
        })),
      );
      items = [...items, ...(response.output ?? []), ...outputs];
    }
    return {
      success: false,
      summary: "Agent exceeded the 50-turn tool limit",
      transcript,
    };
  }
  private async anthropic(input: AgentRunRequest, key: string) {
    const messages: any[] = [
      {
        role: "user",
        content: `${input.instructions}\n\nTask: ${input.taskTitle}\n${input.taskDescription}\nStage: ${input.stage}`,
      },
    ];
    let transcript = "";
    for (let turn = 0; turn < 50; turn++) {
      const response = await this.json(
        "https://api.anthropic.com/v1/messages",
        {
          model: input.modelId,
          max_tokens: 8192,
          messages,
          tools: definitions("anthropic"),
        },
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
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
              content: await this.tools(input.worktreePath).execute({
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
      summary: "Agent exceeded the 50-turn tool limit",
      transcript,
    };
  }
  private async json(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ) {
    const response = await this.request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
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
function definitions(kind: "openai" | "anthropic") {
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
  ];
  return kind === "anthropic"
    ? tools
    : tools.map(({ input_schema, ...tool }) => ({
        type: "function",
        ...tool,
        parameters: input_schema,
        strict: false,
      }));
}
