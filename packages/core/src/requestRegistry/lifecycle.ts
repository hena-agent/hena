import { Effect, PubSub } from "effect";

import { closeEntries } from "./closeEntries";
import {
  type PendingRequestStore,
  rejectEntries,
  snapshotRequest,
} from "./store";

export const listRequests = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
): Effect.Effect<ReadonlyArray<Request>> =>
  store.lock.withPermit(
    Effect.sync(() =>
      Array.from(store.pending.values(), (entry) =>
        snapshotRequest(store, entry.request),
      ),
    ),
  );

export const closeStore = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
): Effect.Effect<void> =>
  store.lock.withPermit(
    closeEntries(store).pipe(
      Effect.flatMap((entries) => rejectEntries(store, entries)),
      Effect.andThen(PubSub.shutdown(store.events)),
    ),
  );
