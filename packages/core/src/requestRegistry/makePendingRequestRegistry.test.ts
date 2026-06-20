import { assert, it } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Fiber,
  Option,
  PubSub,
  Semaphore,
  Stream,
} from "effect";
import { rejectInterrupted } from "./ask";
import { finalizeSettlement } from "./finalizeSettlement";
import { closeStore } from "./lifecycle";
import { makePendingRequestRegistry } from "./makePendingRequestRegistry";
import { makePendingRequestStore } from "./store";
import type { PendingRequestRegistryOptions } from "./types";

interface Input {
  readonly label: string;
}

interface Request {
  readonly id: string;
  readonly label: string;
}

interface SnapshotRequest {
  readonly id: string;
  labels: Array<string>;
  metadata: { value: string };
}

type Event =
  | { readonly type: "asked"; readonly request: Request }
  | { readonly type: "resolved"; readonly requestID: string }
  | { readonly type: "rejected"; readonly requestID: string };

type SnapshotEvent =
  | { readonly type: "asked"; readonly request: SnapshotRequest }
  | { readonly type: "rejected"; readonly requestID: string };

const registryOptions: PendingRequestRegistryOptions<
  Input,
  Request,
  string,
  string,
  Event
> = {
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
};

const makeRegistry = (): ReturnType<
  typeof makePendingRequestRegistry<Input, Request, string, string, Event>
> =>
  makePendingRequestRegistry<Input, Request, string, string, Event>(
    registryOptions,
  );

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

it.effect("fails new requests after the registry scope closes", () =>
  Effect.gen(function* () {
    const registry = yield* Effect.scoped(makeRegistry());
    const exit = yield* registry.ask({ label: "late" }).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("fails closed requests before resolve-before-install", () =>
  Effect.gen(function* () {
    const registry = yield* Effect.scoped(
      makePendingRequestRegistry<Input, Request, string, string, Event>({
        ...registryOptions,
        resolveBeforeInstall: () => Option.some("cached"),
      }),
    );
    const exit = yield* registry.ask({ label: "late" }).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("ignores repeated registry close calls", () =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<Event>();
    const lock = yield* Semaphore.make(1);
    const store = makePendingRequestStore<
      Input,
      Request,
      string,
      string,
      Event
    >(registryOptions, events, lock);

    yield* closeStore(store);
    yield* closeStore(store);

    assert.strictEqual(store.closed, true);
  }),
);

it.effect("keeps finalizing settlements owned until completion", () =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<Event>();
    const lock = yield* Semaphore.make(1);
    const store = makePendingRequestStore<
      Input,
      Request,
      string,
      string,
      Event
    >(registryOptions, events, lock);
    const deferred = yield* Deferred.make<string, string>();
    const entry = {
      deferred,
      request: { id: "req-0", label: "wait" },
    };
    const commitStarted = yield* Deferred.make<void>();
    const releaseCommit = yield* Deferred.make<void>();
    store.settling.set("req-0", entry);

    const settlement = yield* finalizeSettlement({
      store,
      requestID: "req-0",
      entry,
      settlement: {
        value: "accepted",
        event: { type: "resolved", requestID: "req-0" } satisfies Event,
        commit: Deferred.succeed(commitStarted, undefined).pipe(
          Effect.andThen(Deferred.await(releaseCommit)),
        ),
      },
      complete: (pendingEntry, success) =>
        Deferred.succeed(pendingEntry.deferred, success.value),
    }).pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Deferred.await(commitStarted);
    const closing = yield* closeStore(store).pipe(
      Effect.forkDetach({ startImmediately: true }),
    );
    yield* Effect.yieldNow;
    assert.strictEqual(store.closed, false);

    yield* Deferred.succeed(releaseCommit, undefined);
    assert.strictEqual(yield* Fiber.join(settlement), true);
    yield* Fiber.join(closing);
    assert.strictEqual(yield* Deferred.await(deferred), "accepted");
    assert.strictEqual(store.closed, true);
  }),
);

it.effect("ignores interrupt cleanup for finalized requests", () =>
  Effect.gen(function* () {
    const events = yield* PubSub.unbounded<Event>();
    const lock = yield* Semaphore.make(1);
    const store = makePendingRequestStore<
      Input,
      Request,
      string,
      string,
      Event
    >(registryOptions, events, lock);

    yield* rejectInterrupted(store, "req-0");

    assert.strictEqual(store.cancelled.has("req-0"), false);
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

it.effect("does not restore failed settlements after close", () =>
  Effect.gen(function* () {
    const setup = yield* Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* makeRegistry();
        const settlementStarted = yield* Deferred.make<void>();
        const releaseSettlement = yield* Deferred.make<void>();
        const waiter = yield* registry
          .ask({ label: "wait" })
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Effect.yieldNow;
        const settlement = yield* registry
          .succeed("req-0", "missing", () =>
            Deferred.succeed(settlementStarted, undefined).pipe(
              Effect.andThen(Deferred.await(releaseSettlement)),
              Effect.andThen(Effect.fail("builder-failed")),
            ),
          )
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Deferred.await(settlementStarted);
        return { releaseSettlement, settlement, waiter };
      }),
    );

    yield* Deferred.succeed(setup.releaseSettlement, undefined);
    const settlementError = yield* Fiber.join(setup.settlement).pipe(
      Effect.flip,
    );
    const waiterError = yield* Fiber.join(setup.waiter).pipe(Effect.flip);

    assert.strictEqual(settlementError, "builder-failed");
    assert.strictEqual(waiterError, "closed");
  }),
);

it.effect("rejects settling waiters when the registry closes", () =>
  Effect.gen(function* () {
    let committed = false;
    const setup = yield* Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* makeRegistry();
        const settlementStarted = yield* Deferred.make<void>();
        const releaseSettlement = yield* Deferred.make<void>();
        const waiter = yield* registry
          .ask({ label: "wait" })
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Effect.yieldNow;
        const settlement = yield* registry
          .succeed("req-0", "missing", (request) =>
            Deferred.succeed(settlementStarted, undefined).pipe(
              Effect.andThen(Deferred.await(releaseSettlement)),
              Effect.as({
                value: "accepted",
                event: {
                  type: "resolved",
                  requestID: request.id,
                } satisfies Event,
                commit: Effect.sync(() => {
                  committed = true;
                }),
              }),
            ),
          )
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Deferred.await(settlementStarted);
        return { releaseSettlement, settlement, waiter };
      }),
    );

    const waiterError = yield* Fiber.join(setup.waiter).pipe(Effect.flip);
    yield* Deferred.succeed(setup.releaseSettlement, undefined);
    const settlementError = yield* Fiber.join(setup.settlement).pipe(
      Effect.flip,
    );

    assert.strictEqual(waiterError, "closed");
    assert.strictEqual(settlementError, "missing");
    assert.strictEqual(committed, false);
  }),
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

it.effect("does not reject interrupted waiters after settlement claims", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const settlementClaimed = yield* Deferred.make<void>();
      const releaseSettlement = yield* Deferred.make<void>();
      const eventsFiber = yield* registry.events.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const waiter = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const settlement = yield* registry
        .succeed("req-0", "missing", (request) =>
          Deferred.succeed(settlementClaimed, undefined).pipe(
            Effect.andThen(Deferred.await(releaseSettlement)),
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

      yield* Deferred.await(settlementClaimed);
      yield* Fiber.interrupt(waiter);
      yield* Deferred.succeed(releaseSettlement, undefined);
      yield* Fiber.join(settlement);

      assert.deepStrictEqual(
        (yield* Fiber.join(eventsFiber)).map((event) => event.type),
        ["asked", "resolved"],
      );
    }),
  ),
);

it.effect("ignores waiter interruption after settlement completion", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const waiter = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      yield* registry.succeed("req-0", "missing", (request) =>
        Effect.succeed({
          value: "accepted",
          event: { type: "resolved", requestID: request.id },
        }),
      );
      yield* Fiber.interrupt(waiter);

      assert.deepStrictEqual(yield* registry.list(), []);
    }),
  ),
);

it.effect("does not restore failed settlements after waiter interruption", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makeRegistry();
      const settlementClaimed = yield* Deferred.make<void>();
      const releaseSettlement = yield* Deferred.make<void>();
      const waiter = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const settlement = yield* registry
        .succeed("req-0", "missing", () =>
          Deferred.succeed(settlementClaimed, undefined).pipe(
            Effect.andThen(Deferred.await(releaseSettlement)),
            Effect.andThen(Effect.fail("builder-failed")),
          ),
        )
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Deferred.await(settlementClaimed);
      yield* Fiber.interrupt(waiter);
      yield* Deferred.succeed(releaseSettlement, undefined);
      const settlementError = yield* Fiber.join(settlement).pipe(Effect.flip);

      assert.strictEqual(settlementError, "builder-failed");
      assert.deepStrictEqual(yield* registry.list(), []);
    }),
  ),
);

it.effect("snapshots listed requests and asked events when configured", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const registry = yield* makePendingRequestRegistry<
        Input,
        SnapshotRequest,
        string,
        string,
        SnapshotEvent
      >({
        idPrefix: "req",
        makeRequest: (id, input) => ({
          id,
          labels: [input.label],
          metadata: { value: input.label },
        }),
        snapshotRequest: (request) => ({
          id: request.id,
          labels: [...request.labels],
          metadata: { ...request.metadata },
        }),
        askedEvent: (request) => ({ type: "asked", request }),
        rejectOnShutdown: (request) => ({
          failure: "closed",
          event: { type: "rejected", requestID: request.id },
        }),
      });
      const eventsFiber = yield* registry.events.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const waiter = yield* registry
        .ask({ label: "wait" })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const events = yield* Fiber.join(eventsFiber);
      const [pending] = yield* registry.list();
      if (pending === undefined) {
        throw new Error("expected a pending request");
      }
      pending.labels.push("mutated");
      pending.metadata.value = "mutated";

      assert.deepStrictEqual(yield* registry.list(), [
        { id: "req-0", labels: ["wait"], metadata: { value: "wait" } },
      ]);
      const [event] = events;
      if (event?.type !== "asked") {
        throw new Error("expected asked event");
      }
      assert.deepStrictEqual(event.request, {
        id: "req-0",
        labels: ["wait"],
        metadata: { value: "wait" },
      });

      yield* registry.fail("req-0", "missing", () =>
        Effect.succeed({
          failure: "rejected",
          event: { type: "rejected", requestID: "req-0" },
        }),
      );
      yield* Fiber.join(waiter).pipe(Effect.exit);
    }),
  ),
);
