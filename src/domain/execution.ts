import { z } from "zod";
export const ExecutionRequestSchema = z.object({
  command: z.string().trim().min(1),
  args: z.array(z.string()).max(200).default([]),
  cwd: z.string().trim().min(1),
  network: z.enum(["none", "localhost", "public"]).default("none"),
  stdin: z.string().max(2_000_000).optional(),
});
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export interface ExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  startedAt: Date;
  completedAt: Date;
}
export interface CommandExecutor {
  execute(input: ExecutionRequest): Promise<ExecutionResult>;
}
export interface ManagedProcess {
  pid: number;
  stop(): Promise<void>;
}
export interface ManagedCommandExecutor extends CommandExecutor {
  start(input: ExecutionRequest): Promise<ManagedProcess>;
}
