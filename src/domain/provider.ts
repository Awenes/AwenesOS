import { z } from "zod";

export const ProviderKindSchema = z.enum(["openai", "anthropic"]);
export const ProviderAuthMethodSchema = z.enum(["api_key", "cli"]);
export const ProviderStatusSchema = z.enum(["unverified", "ready", "error", "disconnected"]);

export const ProviderConnectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: ProviderKindSchema,
  authMethod: ProviderAuthMethodSchema,
  command: z.string().trim().min(1).max(120).nullable().default(null),
  models: z.array(z.string().trim().min(1).max(120)).max(100).default([])
}).superRefine((value, context) => {
  if (value.authMethod === "cli" && !value.command) context.addIssue({ code: "custom", message: "A CLI command is required" });
  if (value.authMethod === "api_key" && value.command) context.addIssue({ code: "custom", message: "API-key connections cannot define a CLI command" });
});

export type ProviderKind = z.infer<typeof ProviderKindSchema>;
export type ProviderAuthMethod = z.infer<typeof ProviderAuthMethodSchema>;
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type ProviderConnectionInput = z.infer<typeof ProviderConnectionInputSchema>;

export interface ProviderConnection extends ProviderConnectionInput {
  id: string;
  status: ProviderStatus;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
}

export interface SecretVault {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export interface ProviderProbe {
  check(connection: ProviderConnection, secret: string | null): Promise<ProviderProbeResult>;
}
export interface ProviderProbeResult { ready: boolean; detail: string; resolvedCommand?: string; }
