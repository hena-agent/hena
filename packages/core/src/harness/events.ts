import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, PubSub, Queue, type Scope, Stream } from "effect";

import {
  type DeltaQueuedEvent,
  deltaKey,
  type QueuedEvent,
} from "./eventQueue";
import {
  type HarnessEventEnvelope,
  toHarnessEventEnvelope,
} from "./eventSchema";

export interface HarnessEventBridge {
  readonly publish: (event: PiAgent.AgentHarnessEvent) => Effect.Effect<void>;
  readonly shutdown: Effect.Effect<void>;
  readonly stream: Stream.Stream<HarnessEventEnvelope>;
}

export interface UnsafeHarnessEventBridge extends HarnessEventBridge {
  readonly publishUnsafe: (event: PiAgent.AgentHarnessEvent) => void;
}

type HarnessEventListener = (event: PiAgent.AgentHarnessEvent) => void;

export interface HarnessEventSource {
  readonly subscribe: (listener: HarnessEventListener) => () => void;
}

export const makeUnsafeHarnessEventBridge: () => Effect.Effect<
  UnsafeHarnessEventBridge,
  never,
  Scope.Scope
> = Effect.fnUntraced(function* () {
  const queue = yield* Queue.unbounded<QueuedEvent>();
  const pubsub = yield* PubSub.unbounded<HarnessEventEnvelope>();
  const pendingDeltas = new Map<string, DeltaQueuedEvent>();

  const shutdown = Queue.shutdown(queue).pipe(
    Effect.andThen(PubSub.shutdown(pubsub)),
    Effect.asVoid,
  );

  const publishUnsafe = (event: PiAgent.AgentHarnessEvent): void => {
    const key = deltaKey(event);
    if (key === undefined) {
      pendingDeltas.clear();
      Queue.offerUnsafe(queue, { _tag: "reliable", event });
      return;
    }

    const pending = pendingDeltas.get(key);
    if (pending === undefined) {
      const next: DeltaQueuedEvent = { _tag: "deltaFlush", key, event };
      pendingDeltas.set(key, next);
      Queue.offerUnsafe(queue, next);
      return;
    }

    // The queued object is the flush token; the drain identity-checks it.
    pending.event = event;
  };

  const drain = Effect.forever(
    Effect.gen(function* () {
      const queued = yield* Queue.take(queue);
      if (queued._tag === "reliable") {
        yield* PubSub.publish(pubsub, toHarnessEventEnvelope(queued.event));
        return;
      }

      if (pendingDeltas.get(queued.key) === queued) {
        pendingDeltas.delete(queued.key);
      }
      yield* PubSub.publish(pubsub, toHarnessEventEnvelope(queued.event));
    }),
  );

  yield* drain.pipe(Effect.forkScoped({ startImmediately: true }));
  yield* Effect.addFinalizer(() => shutdown);

  return {
    publish: (event: PiAgent.AgentHarnessEvent): Effect.Effect<void> =>
      Effect.sync(() => {
        publishUnsafe(event);
      }),
    publishUnsafe,
    shutdown,
    stream: Stream.fromPubSub(pubsub),
  } satisfies UnsafeHarnessEventBridge;
});

export const makeHarnessEventBridge: () => Effect.Effect<
  HarnessEventBridge,
  never,
  Scope.Scope
> = Effect.fnUntraced(function* () {
  const { publish, shutdown, stream } = yield* makeUnsafeHarnessEventBridge();
  return { publish, shutdown, stream } satisfies HarnessEventBridge;
});
