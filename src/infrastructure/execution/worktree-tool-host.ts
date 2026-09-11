import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { ExecutionGuard } from "../../application/execution-guard.js";
import type { AgentToolCall, AgentToolHost } from "../../domain/agent-tools.js";
import type { CommandExecutor } from "../../domain/execution.js";
import type { ExecutionPolicy } from "../../domain/project.js";
import type { AgentCapability } from "../../domain/agent-role.js";
export class WorktreeToolHost implements AgentToolHost {
  private guard: ExecutionGuard;
  constructor(
    private root: string,
    policy: ExecutionPolicy,
    private commands: CommandExecutor,
    private capabilities: AgentCapability[],
  ) {
    this.guard = new ExecutionGuard(root, policy);
  }
  async execute(call: AgentToolCall) {
    switch (call.name) {
      case "list_files":
        return (await walk(this.root)).join("\n");
      case "read_file": {
        const value = z.object({ path: z.string() }).parse(call.arguments);
        return readFile(
          this.guard.assertWritablePath(join(this.root, value.path)),
          "utf8",
        );
      }
      case "write_file": {
        this.requireCapability("code", "write files");
        const value = z
          .object({ path: z.string(), content: z.string().max(2_000_000) })
          .parse(call.arguments);
        const path = this.guard.assertWritablePath(join(this.root, value.path));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, value.content, "utf8");
        return `Wrote ${value.content.length} characters to ${value.path}`;
      }
      case "run_command": {
        if (
          !this.capabilities.some((value) =>
            ["code", "test", "review", "browser"].includes(value),
          )
        )
          throw new Error("This agent role is not allowed to run commands");
        const value = z
          .object({
            command: z.string(),
            args: z.array(z.string()).default([]),
            network: z.enum(["none", "localhost", "public"]).default("none"),
          })
          .parse(call.arguments);
        const result = await this.commands.execute({
          ...value,
          cwd: this.root,
        });
        return JSON.stringify(result);
      }
      default:
        throw new Error(`Unknown agent tool: ${(call as AgentToolCall).name}`);
    }
  }
  private requireCapability(capability: AgentCapability, action: string) {
    if (!this.capabilities.includes(capability))
      throw new Error(
        `This agent role requires the ${capability} capability to ${action}`,
      );
  }
}
async function walk(root: string) {
  const output: string[] = [];
  async function visit(path: string, prefix = "") {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist", "dist-desktop"].includes(entry.name))
        continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (output.length < 5000) await visit(join(path, entry.name), relative);
      } else output.push(relative);
      if (output.length >= 5000) return;
    }
  }
  await visit(root);
  return output;
}
