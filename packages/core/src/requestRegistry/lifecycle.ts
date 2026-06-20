import { Deferred, Effect } from "effect";

import type { RequestLifecycleContext } from "./contexts";
import type { PendingRequestEntry } from "./types";

export const rejectEntries = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  context: RequestLifecycleContext<Input, Request, Value, Failure, Event>,
  entries: Iterable<PendingRequestEntry<Request, Value, Failure>>,
): Effect.Effect<void> =>
  Effect.forEach(
    entries,
    (entry) => {
      const failure = context.options.rejectOnShutdown(entry.request);
      return context
        .publishSettlement(failure)
        .pipe(
          Effect.andThen(Deferred.fail(entry.deferred, failure.failure)),
          Effect.asVoid,
        );
    },
    { discard: true },
  ).pipe(Effect.asVoid);

const rejectInterruptedEntry = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  context: RequestLifecycleContext<Input, Request, Value, Failure, Event>,
  requestID: string,
): Effect.Effect<void> =>
  Effect.sync(() => {
    const entry = context.pending.get(requestID);
    context.pending.delete(requestID);
    return entry;
  }).pipe(
    Effect.flatMap((entry) =>
      entry === undefined ? Effect.void : rejectEntries(context, [entry]),
    ),
    Effect.uninterruptible,
  );

export const askPendingRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  context: RequestLifecycleContext<Input, Request, Value, Failure, Event>,
  input: Input,
): Effect.Effect<Value, Failure> =>
  Effect.gen(function* () {
    const id = context.allocateID();
    const deferred = yield* Deferred.make<Value, Failure>();
    const request = context.options.makeRequest(id, input);
    const install = Effect.sync(() => {
      context.pending.set(id, { deferred, request });
    }).pipe(
      Effect.andThen(context.publish(context.options.askedEvent(request))),
      Effect.uninterruptible,
    );

    return yield* install.pipe(
      Effect.andThen(Deferred.await(deferred)),
      Effect.onInterrupt(() => rejectInterruptedEntry(context, id)),
      Effect.ensuring(Effect.sync(() => context.pending.delete(id))),
    );
  });
