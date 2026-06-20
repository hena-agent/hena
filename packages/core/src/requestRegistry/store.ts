import { Deferred, Effect, PubSub, type Semaphore } from "effect";

import type {
  PendingRequestEntry,
  PendingRequestMap,
  PendingRequestRegistryOptions,
  PendingRequestSettlement,
} from "./types";

export interface PendingRequestStore<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  readonly cancelled: Set<string>;
  closed: boolean;
  nextID: number;
  readonly events: PubSub.PubSub<Event>;
  readonly lock: Semaphore.Semaphore;
  readonly options: PendingRequestRegistryOptions<
    Input,
    Request,
    Failure,
    Event
  >;
  readonly pending: PendingRequestMap<Request, Value, Failure>;
  readonly settling: PendingRequestMap<Request, Value, Failure>;
}

export const makePendingRequestStore = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  options: PendingRequestRegistryOptions<Input, Request, Failure, Event>,
  events: PubSub.PubSub<Event>,
  lock: Semaphore.Semaphore,
): PendingRequestStore<Input, Request, Value, Failure, Event> => ({
  cancelled: new Set(),
  closed: false,
  events,
  lock,
  nextID: 0,
  options,
  pending: new Map(),
  settling: new Map(),
});

export const publish = <Event>(
  store: { readonly events: PubSub.PubSub<Event> },
  event: Event,
): Effect.Effect<void> =>
  PubSub.publish(store.events, event).pipe(Effect.asVoid);

export const snapshotRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  request: Request,
): Request => store.options.snapshotRequest?.(request) ?? request;

export const publishSettlement = <Event>(
  store: { readonly events: PubSub.PubSub<Event> },
  settlement: PendingRequestSettlement<Event>,
): Effect.Effect<void> =>
  (settlement.commit ?? Effect.void).pipe(
    Effect.andThen(publish(store, settlement.event)),
    Effect.asVoid,
  );

export const rejectEntries = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  entries: Iterable<PendingRequestEntry<Request, Value, Failure>>,
): Effect.Effect<void> =>
  Effect.forEach(
    entries,
    (entry) => {
      const failure = store.options.rejectOnShutdown(entry.request);
      return publishSettlement(store, failure).pipe(
        Effect.andThen(Deferred.fail(entry.deferred, failure.failure)),
        Effect.asVoid,
      );
    },
    { discard: true },
  ).pipe(Effect.asVoid);
