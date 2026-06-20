import { Effect } from "effect";

import { finalizeSettlement } from "./finalizeSettlement";
import { restoreSettlingOnError } from "./restoreSettlingOnError";
import type { PendingRequestStore } from "./store";
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
  ) => Effect.Effect<unknown, never, never>;
  readonly makeSettlement: (
    request: Request,
  ) => Effect.Effect<Settlement, MakeSettlement>;
  readonly notFound: NotFound;
  readonly requestID: string;
  readonly store: PendingRequestStore<Input, Request, Value, Failure, Event>;
}

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
    input.store.lock
      .withPermit(
        Effect.sync(() => {
          const entry = input.store.pending.get(input.requestID);
          if (entry !== undefined) {
            input.store.pending.delete(input.requestID);
            input.store.settling.set(input.requestID, entry);
          }
          return entry;
        }),
      )
      .pipe(
        Effect.flatMap(
          (entry): Effect.Effect<void, NotFound | MakeSettlement, never> =>
            entry === undefined
              ? Effect.fail(input.notFound)
              : restore(input.makeSettlement(entry.request)).pipe(
                  Effect.onError(() =>
                    restoreSettlingOnError(input.store, input.requestID, entry),
                  ),
                  Effect.flatMap((settlement) =>
                    finalizeSettlement({
                      store: input.store,
                      requestID: input.requestID,
                      entry,
                      settlement,
                      complete: input.complete,
                    }).pipe(
                      Effect.flatMap((settled) =>
                        settled ? Effect.void : Effect.fail(input.notFound),
                      ),
                    ),
                  ),
                ),
        ),
      ),
  );
