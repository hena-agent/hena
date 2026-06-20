import { Deferred, Effect, PubSub } from "effect";

import {
  type PendingRequestStore,
  publish,
  rejectEntries,
  snapshotRequest,
} from "./store";
import { takePending } from "./takePending";

export const listRequests = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
): Effect.Effect<ReadonlyArray<Request>> =>
  Effect.sync(() =>
    Array.from(store.pending.values(), (entry) =>
      snapshotRequest(store, entry.request),
    ),
  );

const rejectInterrupted = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  requestID: string,
): Effect.Effect<void> =>
  takePending(store, requestID).pipe(
    Effect.flatMap((entry) =>
      entry === undefined
        ? Effect.sync(() => {
            store.cancelled.add(requestID);
          })
        : rejectEntries(store, [entry]),
    ),
    Effect.uninterruptible,
  );

export const askPendingRequest = Effect.fnUntraced(function* <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  input: Input,
) {
  const id = `${store.options.idPrefix}-${store.nextID}`;
  store.nextID += 1;
  const deferred = yield* Deferred.make<Value, Failure>();
  const request = store.options.makeRequest(id, input);
  const installed = yield* Effect.sync(() => {
    if (store.closed) {
      return false;
    }
    store.pending.set(id, { deferred, request });
    return true;
  }).pipe(Effect.uninterruptible);
  if (!installed) {
    return yield* Effect.fail(store.options.rejectOnShutdown(request).failure);
  }

  const eventRequest = snapshotRequest(store, request);
  return yield* publish(store, store.options.askedEvent(eventRequest)).pipe(
    Effect.andThen(Deferred.await(deferred)),
    Effect.onInterrupt(() => rejectInterrupted(store, id)),
    Effect.ensuring(Effect.sync(() => store.pending.delete(id))),
  );
});

export const closeStore = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (store.closed) {
      return [];
    }
    store.closed = true;
    const entries = Array.from(store.pending.values());
    store.pending.clear();
    return entries;
  }).pipe(
    Effect.flatMap((entries) => rejectEntries(store, entries)),
    Effect.andThen(PubSub.shutdown(store.events)),
  );
