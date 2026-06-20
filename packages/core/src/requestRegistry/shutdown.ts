import { Deferred, Effect } from "effect";

import { publishSettlement } from "./publishSettlement";
import type {
  PendingRequestEntry,
  PendingRequestPublish,
  PendingRequestRegistryOptions,
} from "./types";

export const rejectEntries = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  entries: Iterable<PendingRequestEntry<Request, Value, Failure>>,
  options: PendingRequestRegistryOptions<Input, Request, Failure, Event>,
  publish: PendingRequestPublish<Event>,
): Effect.Effect<void> =>
  Effect.forEach(
    entries,
    (entry) => {
      const failure = options.rejectOnShutdown(entry.request);
      return publishSettlement(publish, failure).pipe(
        Effect.andThen(Deferred.fail(entry.deferred, failure.failure)),
        Effect.asVoid,
      );
    },
    { discard: true },
  ).pipe(Effect.asVoid);
