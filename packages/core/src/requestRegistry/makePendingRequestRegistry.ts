import { Effect, PubSub, Stream } from "effect";

import { makeAsk } from "./ask";
import { rejectPendingOnClose } from "./finalizer";
import { getPendingRequest } from "./lookup";
import {
  completeFailure,
  completeSuccess,
  type PendingRequestMap,
} from "./settlement";
import type {
  PendingRequestPublish,
  PendingRequestRegistry,
  PendingRequestRegistryOptions,
} from "./types";

export const makePendingRequestRegistry = Effect.fnUntraced(function* <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(options: PendingRequestRegistryOptions<Input, Request, Failure, Event>) {
  type Registry = PendingRequestRegistry<Input, Request, Value, Failure, Event>;
  const pending: PendingRequestMap<Request, Value, Failure> = new Map();
  const events = yield* PubSub.unbounded<Event>();
  let nextID = 0;

  const publish: PendingRequestPublish<Event> = (
    event: Event,
  ): Effect.Effect<void> => PubSub.publish(events, event).pipe(Effect.asVoid);

  yield* Effect.addFinalizer(() =>
    rejectPendingOnClose(pending, events, options, publish),
  );

  const allocateID = (): string => {
    const id = `${options.idPrefix}-${nextID}`;
    nextID += 1;
    return id;
  };

  const ask = makeAsk<Input, Request, Value, Failure, Event>(
    pending,
    options,
    publish,
    allocateID,
  );

  const list = (): Effect.Effect<ReadonlyArray<Request>> =>
    Effect.sync(() => Array.from(pending.values(), (entry) => entry.request));

  const succeed: Registry["succeed"] = Effect.fnUntraced(
    function* (requestID, notFound, makeSuccess) {
      const entry = yield* getPendingRequest(pending, requestID, notFound);
      const success = yield* makeSuccess(entry.request);
      yield* completeSuccess({ entry, pending, publish }, notFound, success);
    },
  );

  const fail: Registry["fail"] = Effect.fnUntraced(
    function* (requestID, notFound, makeFailure) {
      const entry = yield* getPendingRequest(pending, requestID, notFound);
      const failure = yield* makeFailure(entry.request);
      yield* completeFailure({ entry, pending, publish }, notFound, failure);
    },
  );

  return {
    ask,
    events: Stream.fromPubSub(events),
    fail,
    list,
    succeed,
  } satisfies PendingRequestRegistry<Input, Request, Value, Failure, Event>;
});
