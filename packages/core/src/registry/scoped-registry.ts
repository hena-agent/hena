import { Effect, Ref, Scope } from "effect";

interface Entry<A> {
  readonly id: number;
  readonly value: A;
}

export interface ScopedRegistry<A> {
  readonly register: (value: A) => Effect.Effect<void, never, Scope.Scope>;
  readonly values: Effect.Effect<ReadonlyArray<A>>;
}

export const makeScopedRegistry = <A>(): Effect.Effect<ScopedRegistry<A>> =>
  Effect.gen(function* () {
    const nextId = yield* Ref.make(0);
    const entries = yield* Ref.make<ReadonlyArray<Entry<A>>>([]);

    return {
      register: (value: A) =>
        Effect.gen(function* () {
          const scope = yield* Scope.Scope;
          const id = yield* Ref.getAndUpdate(nextId, (current) => current + 1);
          yield* Ref.update(entries, (items) => [...items, { id, value }]);
          yield* Scope.addFinalizer(
            scope,
            Ref.update(entries, (items) =>
              items.filter((entry) => entry.id !== id),
            ),
          );
        }),
      values: Ref.get(entries).pipe(
        Effect.map((items) => items.map((entry) => entry.value)),
      ),
    } satisfies ScopedRegistry<A>;
  });
