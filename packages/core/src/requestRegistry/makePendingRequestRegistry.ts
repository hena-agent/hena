import { Effect, PubSub, Semaphore, Stream } from "effect";

import { askPendingRequest } from "./ask";
import { closeStore, listRequests } from "./lifecycle";
import { failPendingRequest, succeedPendingRequest } from "./settle";
import { makePendingRequestStore } from "./store";
import type {
  PendingRequestFailure,
  PendingRequestRegistry,
  PendingRequestRegistryOptions,
  PendingRequestSuccess,
} from "./types";

export const makePendingRequestRegistry = Effect.fnUntraced(function* <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  options: PendingRequestRegistryOptions<Input, Request, Value, Failure, Event>,
) {
  type Registry = PendingRequestRegistry<Input, Request, Value, Failure, Event>;
  const events = yield* PubSub.unbounded<Event>();
  const lock = yield* Semaphore.make(1);
  const store = makePendingRequestStore<Input, Request, Value, Failure, Event>(
    options,
    events,
    lock,
  );

  yield* Effect.addFinalizer(() => closeStore(store));

  const ask: Registry["ask"] = (input: Input) =>
    askPendingRequest(store, input);
  const fail: Registry["fail"] = <NotFound, MakeFailure>(
    requestID: string,
    notFound: NotFound,
    makeFailure: (
      request: Request,
    ) => Effect.Effect<PendingRequestFailure<Failure, Event>, MakeFailure>,
  ) => failPendingRequest(store, requestID, notFound, makeFailure);
  const succeed: Registry["succeed"] = <NotFound, MakeSuccess>(
    requestID: string,
    notFound: NotFound,
    makeSuccess: (
      request: Request,
    ) => Effect.Effect<PendingRequestSuccess<Value, Event>, MakeSuccess>,
  ) => succeedPendingRequest(store, requestID, notFound, makeSuccess);

  return {
    ask,
    events: Stream.fromPubSub(events),
    fail,
    list: () => listRequests(store),
    succeed,
  } satisfies Registry;
});
