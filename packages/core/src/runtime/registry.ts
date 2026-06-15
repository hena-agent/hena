import { Effect, Ref } from "effect";
import type { LanguageModel } from "effect/unstable/ai";

import type { RegisteredTool } from "./tool";

type ProviderSlot =
  | { readonly _tag: "Empty" }
  | { readonly _tag: "Full"; readonly provider: LanguageModel.Service };

interface RegistryState {
  readonly provider: ProviderSlot;
  readonly tools: ReadonlyMap<string, RegisteredTool>;
}

export interface Registry {
  readonly provider: () => Effect.Effect<ProviderSlot>;
  readonly registerProvider: (
    provider: LanguageModel.Service,
  ) => Effect.Effect<void>;
  readonly registerTool: (tool: RegisteredTool) => Effect.Effect<void>;
  readonly tool: (name: string) => Effect.Effect<RegisteredTool | undefined>;
  readonly tools: () => Effect.Effect<ReadonlyArray<RegisteredTool>>;
}

const emptyState: RegistryState = {
  provider: { _tag: "Empty" },
  tools: new Map(),
};

export const makeRegistry: Effect.Effect<Registry> = Effect.gen(function* () {
  const state = yield* Ref.make(emptyState);

  return {
    provider: () => Effect.map(Ref.get(state), (value) => value.provider),
    registerProvider: (provider: LanguageModel.Service) =>
      Ref.update(state, (value) => ({
        ...value,
        provider: { _tag: "Full" as const, provider },
      })),
    registerTool: (tool: RegisteredTool) =>
      Ref.update(state, (value) => ({
        ...value,
        tools: new Map(value.tools).set(tool.name, tool),
      })),
    tool: (name: string) =>
      Effect.map(Ref.get(state), (value) => value.tools.get(name)),
    tools: () =>
      Effect.map(Ref.get(state), (value) => [...value.tools.values()]),
  };
});
