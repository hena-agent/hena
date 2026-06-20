import { Effect } from "effect";

import type { SettlePendingRequestInput } from "./contexts";
import type {
  PendingRequestEntry,
  PendingRequestMap,
  PendingRequestSettlement,
} from "./types";

const claim = <
  Request extends { readonly id: string },
  Value,
  Failure,
  NotFound,
>(
  pending: PendingRequestMap<Request, Value, Failure>,
  requestID: string,
  notFound: NotFound,
): Effect.Effect<PendingRequestEntry<Request, Value, Failure>, NotFound> =>
  Effect.sync(() => {
    const entry = pending.get(requestID);
    if (entry !== undefined) {
      pending.delete(requestID);
    }
    return entry;
  }).pipe(
    Effect.flatMap((entry) =>
      entry === undefined ? Effect.fail(notFound) : Effect.succeed(entry),
    ),
  );

const restoreClaim = <Request extends { readonly id: string }, Value, Failure>(
  pending: PendingRequestMap<Request, Value, Failure>,
  entry: PendingRequestEntry<Request, Value, Failure>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (!pending.has(entry.request.id)) {
      pending.set(entry.request.id, entry);
    }
  });

export const settlePendingRequest = <
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
  NotFound,
  MakeSettlement,
>(
  input: SettlePendingRequestInput<
    Request,
    Value,
    Failure,
    Event,
    Settlement,
    NotFound,
    MakeSettlement
  >,
): Effect.Effect<void, NotFound | MakeSettlement> => {
  const { completeDeferred, context, makeSettlement, notFound, requestID } =
    input;
  return Effect.uninterruptibleMask((restore) =>
    claim(context.pending, requestID, notFound).pipe(
      Effect.flatMap((entry) =>
        restore(makeSettlement(entry.request)).pipe(
          Effect.onError(() => restoreClaim(context.pending, entry)),
          Effect.flatMap((settlement) =>
            context
              .publishSettlement(settlement)
              .pipe(
                Effect.andThen(completeDeferred(entry, settlement)),
                Effect.asVoid,
              ),
          ),
        ),
      ),
    ),
  );
};
