import { Deferred, Effect, PubSub, Stream } from "effect";

import { PendingRequestRegistryState } from "./PendingRequestRegistryState";
import { settlePendingRequest } from "./settlePendingRequest";
import type {
  PendingRequestEntry,
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
>(options: PendingRequestRegistryOptions<Input, Request, Failure, Event>) {
  type Registry = PendingRequestRegistry<Input, Request, Value, Failure, Event>;
  const events = yield* PubSub.unbounded<Event>();
  const state = new PendingRequestRegistryState<
    Input,
    Request,
    Value,
    Failure,
    Event
  >(options, events);

  yield* Effect.addFinalizer(() => state.close());

  const succeed = <NotFound, MakeSuccess>(
    requestID: string,
    notFound: NotFound,
    makeSuccess: (
      request: Request,
    ) => Effect.Effect<PendingRequestSuccess<Value, Event>, MakeSuccess>,
  ): Effect.Effect<void, NotFound | MakeSuccess> =>
    settlePendingRequest({
      context: state.settlementContext(),
      requestID,
      notFound,
      makeSettlement: makeSuccess,
      completeDeferred: (
        entry: PendingRequestEntry<Request, Value, Failure>,
        success: PendingRequestSuccess<Value, Event>,
      ) => Deferred.succeed(entry.deferred, success.value),
    });

  const fail = <NotFound, MakeFailure>(
    requestID: string,
    notFound: NotFound,
    makeFailure: (
      request: Request,
    ) => Effect.Effect<PendingRequestFailure<Failure, Event>, MakeFailure>,
  ): Effect.Effect<void, NotFound | MakeFailure> =>
    settlePendingRequest({
      context: state.settlementContext(),
      requestID,
      notFound,
      makeSettlement: makeFailure,
      completeDeferred: (
        entry: PendingRequestEntry<Request, Value, Failure>,
        failure: PendingRequestFailure<Failure, Event>,
      ) => Deferred.fail(entry.deferred, failure.failure),
    });

  return {
    ask: state.ask.bind(state),
    events: Stream.fromPubSub(events),
    fail,
    list: state.list.bind(state),
    succeed,
  } satisfies Registry;
});
