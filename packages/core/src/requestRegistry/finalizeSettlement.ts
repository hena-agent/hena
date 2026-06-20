import { Effect } from "effect";

import { type PendingRequestStore, publishSettlement } from "./store";
import type { PendingRequestEntry, PendingRequestSettlement } from "./types";

interface FinalizeSettlementInput<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
> {
  readonly complete: (
    entry: PendingRequestEntry<Request, Value, Failure>,
    settlement: Settlement,
  ) => Effect.Effect<unknown, never, never>;
  readonly entry: PendingRequestEntry<Request, Value, Failure>;
  readonly requestID: string;
  readonly settlement: Settlement;
  readonly store: PendingRequestStore<Input, Request, Value, Failure, Event>;
}

export const finalizeSettlement = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
>(
  input: FinalizeSettlementInput<
    Input,
    Request,
    Value,
    Failure,
    Event,
    Settlement
  >,
): Effect.Effect<void, never, never> => {
  const { complete, entry, requestID, settlement, store } = input;
  return store.lock.withPermit(
    Effect.sync(() => {
      if (store.closed || store.settling.get(requestID) !== entry) {
        return false;
      }
      store.cancelled.delete(requestID);
      return true;
    }).pipe(
      Effect.flatMap((owned) =>
        owned
          ? publishSettlement(store, settlement).pipe(
              Effect.andThen(complete(entry, settlement)),
              Effect.ensuring(
                Effect.sync(() => {
                  store.settling.delete(requestID);
                  store.cancelled.delete(requestID);
                }),
              ),
            )
          : Effect.void,
      ),
    ),
  );
};
