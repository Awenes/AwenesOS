import { z } from "zod";
const LocalUrl = z
  .string()
  .url()
  .refine((value) => {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }, "Only localhost URLs are supported");
export const BrowserAssertionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("visible"), selector: z.string().min(1) }),
  z.object({
    type: z.literal("text"),
    selector: z.string().min(1),
    value: z.string(),
  }),
  z.object({ type: z.literal("url"), value: z.string().min(1) }),
  z.object({
    type: z.literal("status"),
    value: z.number().int().min(100).max(599),
  }),
]);
export const BrowserActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), selector: z.string().min(1) }),
  z.object({
    type: z.literal("fill"),
    selector: z.string().min(1),
    credentialKey: z.string().min(1),
  }),
  z.object({
    type: z.literal("press"),
    selector: z.string().min(1),
    key: z.string().min(1),
  }),
  z.object({ type: z.literal("wait_for"), selector: z.string().min(1) }),
]);
export const BrowserTestConfigSchema = z
  .object({
    projectId: z.string().uuid(),
    baseUrl: LocalUrl,
    healthCheckUrl: LocalUrl,
    startCommand: z.string().trim().min(1),
    startArgs: z.array(z.string()).default([]),
    setupCommand: z
      .object({ command: z.string(), args: z.array(z.string()).default([]) })
      .nullable()
      .default(null),
    cleanupCommand: z
      .object({ command: z.string(), args: z.array(z.string()).default([]) })
      .nullable()
      .default(null),
    credentialKeys: z.array(z.string().trim().min(1)).default([]),
    actions: z.array(BrowserActionSchema).max(100).default([]),
    assertions: z.array(BrowserAssertionSchema).min(1).max(100),
    browserExecutable: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    if (new URL(value.baseUrl).origin !== new URL(value.healthCheckUrl).origin)
      ctx.addIssue({
        code: "custom",
        message: "Health check must use the same localhost origin",
      });
    for (const action of value.actions)
      if (
        action.type === "fill" &&
        !value.credentialKeys.includes(action.credentialKey)
      )
        ctx.addIssue({
          code: "custom",
          message: `Missing declared credential: ${action.credentialKey}`,
        });
  });
export type BrowserTestConfig = z.infer<typeof BrowserTestConfigSchema>;
export interface BrowserSetupSuggestion {
  startCommand: string;
  startArgs: string[];
  baseUrl: string;
  healthCheckUrl: string;
  browserExecutable: string;
  scriptOptions: string[];
  warnings: string[];
}
export type BrowserAssertion = z.infer<typeof BrowserAssertionSchema>;
export interface BrowserTestEvidence {
  id: string;
  runId: string;
  passed: boolean;
  screenshotPath: string | null;
  tracePath: string | null;
  consoleErrors: string[];
  failedRequests: string[];
  assertions: Array<{
    assertion: BrowserAssertion;
    passed: boolean;
    detail: string;
  }>;
  createdAt: Date;
}
