import { Deferred, type Effect } from "effect";

import { settlePendingRequest } from "./settlement";
import type { PendingRequestStore } from "./store";
import type { PendingRequestEntry, PendingRequestSuccess } from "./types";

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
