import type { Effect } from "effect";

import type {
  PendingRequestEntry,
  PendingRequestMap,
  PendingRequestRegistryOptions,
  PendingRequestSettlement,
} from "./types";

export interface RequestLifecycleContext<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  readonly allocateID: () => string;
  readonly options: PendingRequestRegistryOptions<
    Input,
    Request,
    Failure,
    Event
  >;
  readonly pending: PendingRequestMap<Request, Value, Failure>;
  readonly publish: (event: Event) => Effect.Effect<void>;
  readonly publishSettlement: (
    settlement: PendingRequestSettlement<Event>,
  ) => Effect.Effect<void>;
}

export interface SettlePendingRequestContext<Request, Value, Failure, Event> {
  readonly pending: PendingRequestMap<Request, Value, Failure>;
  readonly publishSettlement: (
    settlement: PendingRequestSettlement<Event>,
  ) => Effect.Effect<void>;
}

export interface SettlePendingRequestInput<
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
  Settlement extends PendingRequestSettlement<Event>,
  NotFound,
  MakeSettlement,
> {
  readonly completeDeferred: (
    entry: PendingRequestEntry<Request, Value, Failure>,
    settlement: Settlement,
  ) => Effect.Effect<unknown>;
  readonly context: SettlePendingRequestContext<Request, Value, Failure, Event>;
  readonly makeSettlement: (
    request: Request,
  ) => Effect.Effect<Settlement, MakeSettlement>;
  readonly notFound: NotFound;
  readonly requestID: string;
}
