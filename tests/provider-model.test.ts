import { describe, expect, it } from "vitest";
import {
  PROVIDER_MODELS,
  providerModelName,
} from "../src/domain/provider-model.js";

describe("provider model catalogue", () => {
  it("keeps friendly model names separate from provider IDs", () => {
    for (const options of Object.values(PROVIDER_MODELS)) {
      expect(options.length).toBeGreaterThan(0);
      expect(new Set(options.map((model) => model.id)).size).toBe(options.length);
      expect(options.every((model) => model.name !== model.id)).toBe(true);
    }
  });

  it("resolves provider IDs to names and safely preserves unknown IDs", () => {
    expect(providerModelName("openai", "gpt-5.6-terra")).toBe(
      "GPT-5.6 Terra",
    );
    expect(providerModelName("anthropic", "custom-model")).toBe(
      "custom-model",
    );
  });
});
