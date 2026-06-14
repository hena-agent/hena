import { Effect, Ref } from "effect";
import type { CoreEvent, EventPayload } from "../events/events";
import { type CoreServices, EventBus } from "../services/services";
import { now } from "./now";
import type { SessionState } from "./state";

export const emit = (
  state: SessionState,
  payload: EventPayload,
): Effect.Effect<CoreEvent, never, CoreServices> =>
  Effect.gen(function* () {
    const bus = yield* EventBus;
    const sequence = yield* Ref.getAndUpdate(
      state.sequence,
      (value) => value + 1,
    );
    const event: CoreEvent = {
      ...payload,
      schemaVersion: 1 as const,
      sequence,
      sessionId: state.id,
      timestamp: now(),
    };
    bus.publish(event);
    return event;
  });
