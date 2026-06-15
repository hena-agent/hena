import { Effect, type Scope } from "effect";

import { makeScopedRegistry } from "../registry/scoped-registry";

export interface SystemPromptSection {
  readonly content: string;
}

export interface SystemPromptRegistry {
  readonly contribute: (
    section: SystemPromptSection,
  ) => Effect.Effect<void, never, Scope.Scope>;
  readonly sections: Effect.Effect<ReadonlyArray<SystemPromptSection>>;
  readonly text: Effect.Effect<string>;
}

export const makeSystemPromptRegistry = Effect.fnUntraced(function* () {
  const registry = yield* makeScopedRegistry<SystemPromptSection>();

  return {
    contribute: registry.register,
    sections: registry.values,
    text: registry.values.pipe(
      Effect.map((sections) =>
        sections.map((section) => section.content).join("\n\n"),
      ),
    ),
  } satisfies SystemPromptRegistry;
});
