import { describe, expect, it } from "vitest";
import { ApiAgentRunner } from "../src/infrastructure/providers/api-agent-runner.js";
import type {
  AgentToolCall,
  AgentToolHost,
} from "../src/domain/agent-tools.js";
import type { SecretVault } from "../src/domain/provider.js";
const provider = {
  id: "provider",
  name: "OpenAI",
  kind: "openai" as const,
  authMethod: "api_key" as const,
  command: null,
  models: ["model"],
  status: "ready" as const,
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastCheckedAt: new Date(),
};
const input = {
  provider,
  modelId: "model",
  instructions: "Implement",
  taskTitle: "Task",
  taskDescription: "Description",
  stage: "implement",
  priorContext: "",
  worktreePath: "C:\\work",
  timeoutSeconds: 30,
  maxTurns: 3,
  capabilities: ["code" as const],
};
describe("ApiAgentRunner", () => {
  it("executes provider tool calls through the local constrained host", async () => {
    const calls: AgentToolCall[] = [];
    const host: AgentToolHost = {
      execute: async (call) => {
        calls.push(call);
        return "contents";
      },
    };
    let request = 0;
    const fakeFetch = async (_url: any, options: any) => {
      request++;
      const body = JSON.parse(options.body);
      if (request === 2)
        expect(body.input[0]).toMatchObject({
          role: "developer",
          content: "Implement",
        });
      return new Response(
        JSON.stringify(
          request === 1
            ? {
                output: [
                  {
                    type: "function_call",
                    call_id: "1",
                    name: "read_file",
                    arguments: '{"path":"src/a.ts"}',
                  },
                ],
              }
            : { output: [], output_text: "Verified" },
        ),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const vault: SecretVault = {
      set: async () => {},
      get: async () => "key",
      delete: async () => {},
    };
    const result = await new ApiAgentRunner(
      vault,
      () => host,
      fakeFetch as typeof fetch,
    ).run(input);
    expect(calls).toEqual([
      { id: "1", name: "read_file", arguments: { path: "src/a.ts" } },
    ]);
    expect(result).toMatchObject({ success: true, summary: "Verified" });
  });
  it("includes the approved plan and prior evidence in the initial prompt", async () => {
    const host: AgentToolHost = { execute: async () => "contents" };
    let firstBody: any;
    const fakeFetch = async (_url: any, options: any) => {
      firstBody ??= JSON.parse(options.body);
      return new Response(
        JSON.stringify({ output: [], output_text: "Verified" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const vault: SecretVault = {
      set: async () => {},
      get: async () => "key",
      delete: async () => {},
    };
    await new ApiAgentRunner(vault, () => host, fakeFetch as typeof fetch).run(
      {
        ...input,
        priorContext:
          "## Approved plan (v1)\nAdd a null check before dereferencing.",
      },
    );
    expect(firstBody.input[1].content).toContain("Approved plan");
    expect(firstBody.input[1].content).toContain("null check");
  });
  it("stops at the configured role turn limit", async () => {
    const host: AgentToolHost = { execute: async () => "contents" };
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          output: [
            {
              type: "function_call",
              call_id: "1",
              name: "read_file",
              arguments: '{"path":"src/a.ts"}',
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const vault: SecretVault = {
      set: async () => {},
      get: async () => "key",
      delete: async () => {},
    };
    const result = await new ApiAgentRunner(
      vault,
      () => host,
      fakeFetch as typeof fetch,
    ).run({ ...input, maxTurns: 1 });
    expect(result).toMatchObject({
      success: false,
      summary: "Agent exceeded the 1-turn tool limit",
    });
  });
});
