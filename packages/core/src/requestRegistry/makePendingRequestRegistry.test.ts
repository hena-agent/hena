import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Stream } from "effect";

import { makePendingRequestRegistry } from "./makePendingRequestRegistry";

interface Input {
  readonly label: string;
}

interface Request {
  readonly id: string;
  readonly label: string;
}

type Event =
  | { readonly type: "asked"; readonly request: Request }
  | { readonly type: "resolved"; readonly requestID: string }
  | { readonly type: "rejected"; readonly requestID: string };

const makeRegistry = (): ReturnType<
  typeof makePendingRequestRegistry<Input, Request, string, string, Event>
> =>
  makePendingRequestRegistry<Input, Request, string, string, Event>({
    idPrefix: "req",
    makeRequest: (id: string, input: Input): Request => ({
      id,
      label: input.label,
    }),
    askedEvent: (request: Request): Event => ({ type: "asked", request }),
    rejectOnShutdown: (request: Request) => ({
      failure: "closed",
      event: { type: "rejected", requestID: request.id },
    }),
  });

it.effect("tracks pending requests and resolves entries", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const eventsFiber = yield* registry.events.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const fiber = yield* registry
        .ask({ label: "continue" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const [request] = yield* registry.list();
      assert.deepStrictEqual(request, { id: "req-0", label: "continue" });

      yield* registry.succeed("req-0", "missing", (resolvedRequest) =>
        Effect.succeed({
          value: "accepted",
          event: { type: "resolved", requestID: resolvedRequest.id },
        }),
      );

      assert.strictEqual(yield* Fiber.join(fiber), "accepted");
      assert.deepStrictEqual(yield* registry.list(), []);
      assert.deepStrictEqual(
        (yield* Fiber.join(eventsFiber)).map((event) => event.type),
        ["asked", "resolved"],
      );
    }),
  ),
);

it.effect("fails entries and rejects pending requests on scope close", () =>
  Effect.gen(function* () {
    const rejectExit = yield* Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* makeRegistry();
        const fiber = yield* registry
          .ask({ label: "wait" })
          .pipe(Effect.forkDetach({ startImmediately: true }));
        yield* Effect.yieldNow;
        return fiber;
      }),
    ).pipe(Effect.flatMap(Fiber.join), Effect.exit);

    assert.strictEqual(rejectExit._tag, "Failure");
  }),
);

it.effect("rejects an asked request when its waiter is interrupted", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const eventsFiber = yield* registry.events.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const fiber = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);

      assert.deepStrictEqual(yield* registry.list(), []);
      assert.deepStrictEqual(
        (yield* Fiber.join(eventsFiber)).map((event) => event.type),
        ["asked", "rejected"],
      );
    }),
  ),
);

it.effect("restores pending requests when settlement construction fails", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const fiber = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const failure = yield* registry
        .succeed("req-0", "missing", () => Effect.fail("builder-failed"))
        .pipe(Effect.flip);

      assert.strictEqual(failure, "builder-failed");
      assert.deepStrictEqual(yield* registry.list(), [
        { id: "req-0", label: "wait" },
      ]);

      yield* registry.succeed("req-0", "missing", (request) =>
        Effect.succeed({
          value: "accepted",
          event: { type: "resolved", requestID: request.id },
        }),
      );

      assert.strictEqual(yield* Fiber.join(fiber), "accepted");
    }),
  ),
);

it.effect("claims requests before running settlement effects", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const releaseFirst = yield* Deferred.make<void>();
      let settlementBuilders = 0;
      const waiter = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const first = yield* registry
        .succeed("req-0", "missing", (request) =>
          Effect.sync(() => {
            settlementBuilders += 1;
          }).pipe(
            Effect.andThen(Deferred.await(releaseFirst)),
            Effect.as({
              value: "accepted",
              event: {
                type: "resolved",
                requestID: request.id,
              } satisfies Event,
            }),
          ),
        )
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const secondError = yield* registry
        .fail("req-0", "missing", () =>
          Effect.sync(() => {
            settlementBuilders += 1;
            return {
              failure: "rejected",
              event: { type: "rejected", requestID: "req-0" } satisfies Event,
            };
          }),
        )
        .pipe(Effect.flip);

      assert.strictEqual(secondError, "missing");
      assert.strictEqual(settlementBuilders, 1);
      assert.deepStrictEqual(yield* registry.list(), []);

      yield* Deferred.succeed(releaseFirst, undefined);
      yield* Fiber.join(first);
      assert.strictEqual(yield* Fiber.join(waiter), "accepted");
    }),
  ),
);
