import { Effect, PubSub, Stream } from "effect";
import type { Response } from "effect/unstable/ai";

export type CoreEvent =
  | { readonly type: "run.started" }
  | { readonly type: "run.ended" }
  | { readonly type: "part"; readonly part: Response.AnyPart }
  | { readonly type: "tool.result"; readonly part: Response.AnyPart }
  | {
      readonly type: "ask.requested";
      readonly id: string;
      readonly prompt: string;
    }
  | {
      readonly type: "ask.replied";
      readonly id: string;
      readonly answer: string;
    };

export interface EventBus {
  readonly publish: (event: CoreEvent) => Effect.Effect<void>;
  readonly stream: Stream.Stream<CoreEvent>;
}

export const makeEventBus = Effect.fnUntraced(function* () {
  const pubsub = yield* PubSub.unbounded<CoreEvent>();
  return {
    publish: (event: CoreEvent) =>
      PubSub.publish(pubsub, event).pipe(Effect.asVoid),
    stream: Stream.fromPubSub(pubsub),
  } satisfies EventBus;
});
