import { Deferred, Effect } from "effect";
import { publishSettlement } from "./publishSettlement";
import type {
  PendingRequestEntry,
  PendingRequestFailure,
  PendingRequestPublish,
  PendingRequestSettlement,
  PendingRequestSuccess,
} from "./types";

export type PendingRequestMap<Request, Value, Failure> = Map<
  string,
  PendingRequestEntry<Request, Value, Failure>
>;

export interface SettlementContext<
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  readonly entry: PendingRequestEntry<Request, Value, Failure>;
  readonly pending: PendingRequestMap<Request, Value, Failure>;
  readonly publish: PendingRequestPublish<Event>;
}

const takeEntry = <Request extends { readonly id: string }, Value, Failure>(
  pending: PendingRequestMap<Request, Value, Failure>,
  entry: PendingRequestEntry<Request, Value, Failure>,
): boolean => {
  if (pending.get(entry.request.id) !== entry) {
    return false;
  }
  pending.delete(entry.request.id);
  return true;
};

const completePendingRequest = <
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  NotFound,
>(
  context: SettlementContext<Request, Value, Failure, Event>,
  notFound: NotFound,
  settlement: PendingRequestSettlement<Event>,
  complete: (
    entry: PendingRequestEntry<Request, Value, Failure>,
  ) => Effect.Effect<unknown>,
): Effect.Effect<void, NotFound> =>
  Effect.sync(() => takeEntry(context.pending, context.entry)).pipe(
    Effect.flatMap((wasPending) =>
      wasPending ? Effect.void : Effect.fail(notFound),
    ),
    Effect.andThen(publishSettlement(context.publish, settlement)),
    Effect.andThen(complete(context.entry)),
    Effect.asVoid,
    Effect.uninterruptible,
  );

export const completeSuccess = <
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  NotFound,
>(
  context: SettlementContext<Request, Value, Failure, Event>,
  notFound: NotFound,
  success: PendingRequestSuccess<Value, Event>,
): Effect.Effect<void, NotFound> =>
  completePendingRequest(context, notFound, success, (entry) =>
    Deferred.succeed(entry.deferred, success.value),
  );

export const completeFailure = <
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  NotFound,
>(
  context: SettlementContext<Request, Value, Failure, Event>,
  notFound: NotFound,
  failure: PendingRequestFailure<Failure, Event>,
): Effect.Effect<void, NotFound> =>
  completePendingRequest(context, notFound, failure, (entry) =>
    Deferred.fail(entry.deferred, failure.failure),
  );
