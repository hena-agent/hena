import { Data, Effect, Ref, Scope } from "effect";
import type { LanguageModel } from "effect/unstable/ai";

export class ModelNotRegistered extends Data.TaggedError("ModelNotRegistered")<
  Record<never, never>
> {}

export interface ModelRegistration {
  readonly id: string;
  readonly model: LanguageModel.Service;
}

export interface ModelRegistry {
  readonly active: Effect.Effect<LanguageModel.Service, ModelNotRegistered>;
  readonly register: (
    registration: ModelRegistration,
  ) => Effect.Effect<void, never, Scope.Scope>;
}

export const makeModelRegistry = Effect.fnUntraced(function* () {
  const active = yield* Ref.make<ModelRegistration | undefined>(undefined);

  return {
    active: Ref.get(active).pipe(
      Effect.flatMap((registration) =>
        registration === undefined
          ? Effect.fail(new ModelNotRegistered())
          : Effect.succeed(registration.model),
      ),
    ),
    register: (registration: ModelRegistration) =>
      Effect.gen(function* () {
        const scope = yield* Scope.Scope;
        yield* Ref.set(active, registration);
        yield* Scope.addFinalizer(
          scope,
          Ref.update(active, (current) =>
            current?.id === registration.id ? undefined : current,
          ),
        );
      }),
  } satisfies ModelRegistry;
});
