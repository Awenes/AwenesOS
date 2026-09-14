import type { ProviderKind } from "./provider.js";

export interface ProviderModelOption {
  name: string;
  id: string;
}

export const PROVIDER_MODELS: Record<ProviderKind, readonly ProviderModelOption[]> = {
  openai: [
    { name: "GPT-6 Astra", id: "gpt-6-astra" },
    { name: "GPT-5.6 Sol", id: "gpt-5.6-sol" },
    { name: "GPT-5.6 Terra", id: "gpt-5.6-terra" },
    { name: "GPT-5.6 Luna", id: "gpt-5.6-luna" },
  ],
  anthropic: [
    { name: "Claude Fable 5.1", id: "claude-fable-5-1" },
    { name: "Claude Opus 5", id: "claude-opus-5" },
    { name: "Claude Sonnet 5", id: "claude-sonnet-5" },
    { name: "Claude Haiku 4.5", id: "claude-haiku-4-5-20251001" },
  ],
};

export function providerModelName(kind: ProviderKind, id: string): string {
  return PROVIDER_MODELS[kind].find((model) => model.id === id)?.name ?? id;
}
