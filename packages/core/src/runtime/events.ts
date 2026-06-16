import { Effect, PubSub, Ref, Stream } from "effect";
import type { Prompt } from "effect/unstable/ai";

import type { StreamPart } from "./assistant";

export type RuntimeEvent =
  | { readonly type: "session_start" }
  | { readonly type: "turn_start"; readonly step: number }
  | { readonly type: "message_start"; readonly step: number }
  | {
      readonly type: "message_delta";
      readonly part: StreamPart;
      readonly step: number;
    }
  | {
      readonly type: "message_end";
      readonly entry: Prompt.AssistantMessage;
      readonly step: number;
    }
  | { readonly type: "tool_start"; readonly entry: Prompt.AssistantMessage }
  | { readonly type: "tool_end"; readonly entry: Prompt.ToolMessage }
  | { readonly type: "turn_end"; readonly step: number }
  | { readonly type: "idle" }
  | { readonly type: "error"; readonly error: unknown };

export const RuntimeEvent = {
  sessionStart: (): RuntimeEvent => ({ type: "session_start" }),
  turnStart: (step: number): RuntimeEvent => ({ type: "turn_start", step }),
  messageStart: (step: number): RuntimeEvent => ({
    type: "message_start",
    step,
  }),
  messageDelta: (part: StreamPart, step: number): RuntimeEvent => ({
    type: "message_delta",
    part,
    step,
  }),
  messageEnd: (entry: Prompt.AssistantMessage, step: number): RuntimeEvent => ({
    type: "message_end",
    entry,
    step,
  }),
  toolStart: (entry: Prompt.AssistantMessage): RuntimeEvent => ({
    type: "tool_start",
    entry,
  }),
  toolEnd: (entry: Prompt.ToolMessage): RuntimeEvent => ({
    type: "tool_end",
    entry,
  }),
  turnEnd: (step: number): RuntimeEvent => ({ type: "turn_end", step }),
  idle: (): RuntimeEvent => ({ type: "idle" }),
  error: (error: unknown): RuntimeEvent => ({ type: "error", error }),
};

export interface EventLog {
  readonly publish: (event: RuntimeEvent) => Effect.Effect<void>;
  readonly events: () => Effect.Effect<ReadonlyArray<RuntimeEvent>>;
  readonly subscribe: () => Stream.Stream<RuntimeEvent>;
}

export const makeEventLog: Effect.Effect<EventLog> = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<RuntimeEvent>();
  const history = yield* Ref.make<ReadonlyArray<RuntimeEvent>>([]);

  const publish = Effect.fnUntraced(function* (event: RuntimeEvent) {
    yield* Ref.update(history, (events) => [...events, event]);
    yield* PubSub.publish(pubsub, event);
  });

  return {
    publish,
    events: () => Ref.get(history),
    subscribe: () => Stream.fromPubSub(pubsub),
  };
});
