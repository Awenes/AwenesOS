import { describe, expect, it } from "vitest";
import type { ProviderConnection } from "../src/domain/provider.js";
import { LocalProviderProbe } from "../src/infrastructure/providers/local-provider-probe.js";

function connection(command: string): ProviderConnection {
  const now = new Date();
  return {
    id: "provider-id",
    name: "Codex",
    kind: "openai",
    authMethod: "cli",
    command,
    models: [],
    status: "unverified",
    error: null,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
  };
}

describe("LocalProviderProbe", () => {
  it("explains how to recover when the provider CLI cannot be found", async () => {
    const result = await new LocalProviderProbe().check(
      connection("C:\\definitely-missing-awenes-test\\codex.exe"),
      null,
    );

    expect(result.ready).toBe(false);
    expect(result.detail).toContain("Codex CLI was not found");
    expect(result.detail).toContain("Install Codex CLI and sign in");
    expect(result.detail).not.toMatch(/\bENOENT\b/);
  });
});
