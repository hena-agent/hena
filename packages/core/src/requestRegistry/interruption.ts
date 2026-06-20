import { Effect } from "effect";

import type { PendingRequestMap } from "./settlement";
import { rejectEntries } from "./shutdown";
import type {
  PendingRequestPublish,
  PendingRequestRegistryOptions,
} from "./types";

export const rejectInterruptedEntry = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  pending: PendingRequestMap<Request, Value, Failure>,
  requestID: string,
  options: PendingRequestRegistryOptions<Input, Request, Failure, Event>,
  publish: PendingRequestPublish<Event>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const entry = pending.get(requestID);
    pending.delete(requestID);
    return entry;
  }).pipe(
    Effect.flatMap((entry) =>
      entry === undefined
        ? Effect.void
        : rejectEntries([entry], options, publish),
    ),
    Effect.uninterruptible,
  );
