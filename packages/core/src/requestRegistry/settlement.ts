import { Deferred, Effect } from "effect";

import { type PendingRequestStore, publishSettlement } from "./store";
import { takePending } from "./takePending";
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
    takePending(input.store, input.requestID).pipe(
      Effect.flatMap((entry) =>
        entry === undefined
          ? Effect.fail(input.notFound)
          : Effect.sync(() => {
              input.store.settling.set(input.requestID, entry);
              return entry;
            }),
      ),
      Effect.flatMap((entry) =>
        restore(input.makeSettlement(entry.request)).pipe(
          Effect.onError(() =>
            Effect.sync(() => {
              input.store.settling.delete(input.requestID);
              if (input.store.cancelled.delete(input.requestID)) {
                return undefined;
              }
              if (!input.store.closed) {
                input.store.pending.set(input.requestID, entry);
                return undefined;
              }
              return input.store.options.rejectOnShutdown(entry.request)
                .failure;
            }).pipe(
              Effect.flatMap((failure) =>
                failure === undefined
                  ? Effect.void
                  : Deferred.fail(entry.deferred, failure).pipe(Effect.asVoid),
              ),
            ),
          ),
          Effect.flatMap((settlement) =>
            publishSettlement(input.store, settlement).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  input.store.cancelled.delete(input.requestID);
                  input.store.settling.delete(input.requestID);
                }),
              ),
              Effect.andThen(input.complete(entry, settlement)),
              Effect.asVoid,
            ),
          ),
        ),
      ),
    ),
  );
