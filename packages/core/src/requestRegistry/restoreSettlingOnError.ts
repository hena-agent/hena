import { Deferred, Effect } from "effect";

import type { PendingRequestStore } from "./store";
import type { PendingRequestEntry } from "./types";

export const restoreSettlingOnError = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  requestID: string,
  entry: PendingRequestEntry<Request, Value, Failure>,
): Effect.Effect<void, never, never> =>
  store.lock
    .withPermit(
      Effect.sync(() => {
        store.settling.delete(requestID);
        if (store.cancelled.delete(requestID)) {
          return undefined;
        }
        if (!store.closed) {
          store.pending.set(requestID, entry);
          return undefined;
        }
        return store.options.rejectOnShutdown(entry.request).failure;
      }),
    )
    .pipe(
      Effect.flatMap((failure) =>
        failure === undefined
          ? Effect.void
          : Deferred.fail(entry.deferred, failure).pipe(Effect.asVoid),
      ),
    );
