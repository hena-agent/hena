import { Effect, Option, Ref } from "effect";
import type { LanguageModel } from "effect/unstable/ai";

import type { RegisteredTool } from "./tool";

interface RegistryState {
  readonly provider: Option.Option<LanguageModel.Service>;
  readonly tools: ReadonlyMap<string, RegisteredTool>;
}

export interface Registry {
  readonly provider: () => Effect.Effect<Option.Option<LanguageModel.Service>>;
  readonly registerProvider: (
    provider: LanguageModel.Service,
  ) => Effect.Effect<void>;
  readonly registerTool: (tool: RegisteredTool) => Effect.Effect<void>;
  readonly tool: (name: string) => Effect.Effect<RegisteredTool | undefined>;
  readonly tools: () => Effect.Effect<ReadonlyArray<RegisteredTool>>;
}

const emptyState: RegistryState = {
  provider: Option.none(),
  tools: new Map(),
};

export const makeRegistry: Effect.Effect<Registry> = Effect.gen(function* () {
  const state = yield* Ref.make(emptyState);

  return {
    provider: () => Effect.map(Ref.get(state), (value) => value.provider),
    registerProvider: (provider: LanguageModel.Service) =>
      Ref.update(state, (value) => ({
        ...value,
        provider: Option.some(provider),
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
