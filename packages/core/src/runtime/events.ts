import { Effect, PubSub, Ref, Stream } from "effect";
import type { Response, Tool } from "effect/unstable/ai";

import type { Entry } from "./entry";

type RuntimeEventType =
  | "session_start"
  | "turn_start"
  | "message_start"
  | "message_delta"
  | "message_end"
  | "tool_start"
  | "tool_end"
  | "turn_end"
  | "idle"
  | "error";

export interface RuntimeEvent {
  readonly type: RuntimeEventType;
  readonly entry?: Entry;
  readonly part?: Response.StreamPart<Record<string, Tool.Any>>;
  readonly step?: number;
  readonly error?: unknown;
}

export interface EventLog {
  readonly publish: (event: RuntimeEvent) => Effect.Effect<void>;
  readonly events: () => Effect.Effect<ReadonlyArray<RuntimeEvent>>;
  readonly subscribe: () => Stream.Stream<RuntimeEvent>;
}

export const makeEventLog: Effect.Effect<EventLog> = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<RuntimeEvent>();
  const history = yield* Ref.make<ReadonlyArray<RuntimeEvent>>([]);

  const publish = (event: RuntimeEvent): Effect.Effect<void> =>
    Effect.gen(function* () {
      yield* Ref.update(history, (events) => [...events, event]);
      yield* PubSub.publish(pubsub, event);
    });

  return {
    publish,
    events: () => Ref.get(history),
    subscribe: () => Stream.fromPubSub(pubsub),
  };
});
