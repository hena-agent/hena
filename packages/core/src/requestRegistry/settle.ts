import { Deferred, type Effect } from "effect";

import { settlePendingRequest } from "./settlement";
import type { PendingRequestStore } from "./store";
import type {
  PendingRequestEntry,
  PendingRequestFailure,
  PendingRequestSuccess,
} from "./types";

export const failPendingRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  NotFound,
  MakeFailure,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  requestID: string,
  notFound: NotFound,
  makeFailure: (
    request: Request,
  ) => Effect.Effect<PendingRequestFailure<Failure, Event>, MakeFailure>,
): Effect.Effect<void, NotFound | MakeFailure> =>
  settlePendingRequest({
    store,
    requestID,
    notFound,
    makeSettlement: makeFailure,
    complete: (
      entry: PendingRequestEntry<Request, Value, Failure>,
      failure: PendingRequestFailure<Failure, Event>,
    ) => Deferred.fail(entry.deferred, failure.failure),
  });

export const succeedPendingRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  NotFound,
  MakeSuccess,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  requestID: string,
  notFound: NotFound,
  makeSuccess: (
    request: Request,
  ) => Effect.Effect<PendingRequestSuccess<Value, Event>, MakeSuccess>,
): Effect.Effect<void, NotFound | MakeSuccess> =>
  settlePendingRequest({
    store,
    requestID,
    notFound,
    makeSettlement: makeSuccess,
    complete: (
      entry: PendingRequestEntry<Request, Value, Failure>,
      success: PendingRequestSuccess<Value, Event>,
    ) => Deferred.succeed(entry.deferred, success.value),
  });
