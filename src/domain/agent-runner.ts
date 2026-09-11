import type { ProviderConnection } from "./provider.js";
export interface AgentRunRequest { provider:ProviderConnection; modelId:string; instructions:string; taskTitle:string; taskDescription:string; stage:string; worktreePath:string; timeoutSeconds:number; }
export interface AgentRunResult { success:boolean; summary:string; transcript:string; }
export interface AgentRunner { run(input:AgentRunRequest):Promise<AgentRunResult>; }
