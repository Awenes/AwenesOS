import type { ProviderConnection } from "./provider.js";
import type { AgentCapability } from "./agent-role.js";
export interface AgentRunRequest {
  provider: ProviderConnection;
  modelId: string;
  instructions: string;
  taskTitle: string;
  taskDescription: string;
  stage: string;
  priorContext: string;
  worktreePath: string;
  timeoutSeconds: number;
  maxTurns: number;
  capabilities: AgentCapability[];
}
export interface AgentRunResult {
  success: boolean;
  summary: string;
  transcript: string;
}
export interface AgentRunner {
  run(input: AgentRunRequest): Promise<AgentRunResult>;
}
