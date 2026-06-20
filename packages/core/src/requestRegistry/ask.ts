import { Deferred, Effect } from "effect";

import { installRequest, publishAsked } from "./askInstall";
import { type PendingRequestStore, rejectEntries } from "./store";
import { takePending } from "./takePending";

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
  const deferred = yield* Deferred.make<Value, Failure>();
  const installation = yield* store.lock.withPermit(
    Effect.sync(() => installRequest(store, input, deferred)).pipe(
      Effect.flatMap((next) => publishAsked(store, next)),
      Effect.uninterruptible,
    ),
  );

  if (installation._tag === "closed") {
    return yield* Effect.fail(installation.failure);
  }
  if (installation._tag === "resolved") {
    return installation.value;
  }
  return yield* Deferred.await(installation.deferred).pipe(
    Effect.onInterrupt(() => rejectInterrupted(store, installation.requestID)),
    Effect.ensuring(
      Effect.sync(() => store.pending.delete(installation.requestID)),
    ),
  );
});
