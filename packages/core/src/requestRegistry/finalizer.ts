import { Effect, PubSub } from "effect";

import type { PendingRequestMap } from "./settlement";
import { rejectEntries } from "./shutdown";
import type {
  PendingRequestPublish,
  PendingRequestRegistryOptions,
} from "./types";

export const rejectPendingOnClose = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  pending: PendingRequestMap<Request, Value, Failure>,
  events: PubSub.PubSub<Event>,
  options: PendingRequestRegistryOptions<Input, Request, Failure, Event>,
  publish: PendingRequestPublish<Event>,
): Effect.Effect<void> => {
  const entries = Array.from(pending.values());
  pending.clear();
  return rejectEntries(entries, options, publish).pipe(
    Effect.andThen(PubSub.shutdown(events)),
    Effect.asVoid,
  );
};
