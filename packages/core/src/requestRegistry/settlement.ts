import { Effect } from "effect";

import { type PendingRequestStore, publishSettlement } from "./store";
import type { PendingRequestEntry, PendingRequestSettlement } from "./types";

interface SettlePendingRequestInput<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
  NotFound,
  MakeSettlement,
> {
  readonly complete: (
    entry: PendingRequestEntry<Request, Value, Failure>,
    settlement: Settlement,
  ) => Effect.Effect<unknown>;
  readonly makeSettlement: (
    request: Request,
  ) => Effect.Effect<Settlement, MakeSettlement>;
  readonly notFound: NotFound;
  readonly requestID: string;
  readonly store: PendingRequestStore<Input, Request, Value, Failure, Event>;
}

const claim = <
  Request extends { readonly id: string },
  Value,
  Failure,
  NotFound,
>(
  store: {
    readonly pending: Map<string, PendingRequestEntry<Request, Value, Failure>>;
  },
  requestID: string,
  notFound: NotFound,
): Effect.Effect<PendingRequestEntry<Request, Value, Failure>, NotFound> =>
  Effect.sync(() => {
    const entry = store.pending.get(requestID);
    store.pending.delete(requestID);
    return entry;
  }).pipe(
    Effect.flatMap((entry) =>
      entry === undefined ? Effect.fail(notFound) : Effect.succeed(entry),
    ),
  );

export const settlePendingRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
  NotFound,
  MakeSettlement,
>(
  input: SettlePendingRequestInput<
    Input,
    Request,
    Value,
    Failure,
    Event,
    Settlement,
    NotFound,
    MakeSettlement
  >,
): Effect.Effect<void, NotFound | MakeSettlement> =>
  Effect.uninterruptibleMask((restore) =>
    claim(input.store, input.requestID, input.notFound).pipe(
      Effect.flatMap((entry) =>
        restore(input.makeSettlement(entry.request)).pipe(
          Effect.onError(() =>
            Effect.sync(() => input.store.pending.set(input.requestID, entry)),
          ),
          Effect.flatMap((settlement) =>
            publishSettlement(input.store, settlement).pipe(
              Effect.andThen(input.complete(entry, settlement)),
              Effect.asVoid,
            ),
          ),
        ),
      ),
    ),
  );
