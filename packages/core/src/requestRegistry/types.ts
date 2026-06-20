import type { Deferred, Effect, Option, Stream } from "effect";

export interface PendingRequestEntry<Request, Value, Failure> {
  readonly deferred: Deferred.Deferred<Value, Failure>;
  readonly request: Request;
}

export type PendingRequestMap<Request, Value, Failure> = Map<
  string,
  PendingRequestEntry<Request, Value, Failure>
>;

export interface PendingRequestSettlement<Event> {
  readonly event: Event;
  readonly commit?: Effect.Effect<void>;
}

export interface PendingRequestSuccess<Value, Event>
  extends PendingRequestSettlement<Event> {
  readonly value: Value;
}

export interface PendingRequestFailure<Failure, Event>
  extends PendingRequestSettlement<Event> {
  readonly failure: Failure;
}

export interface PendingRequestRegistryOptions<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  readonly askedEvent: (request: Request) => Event;
  readonly guardInstall?: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>;
  readonly idPrefix: string;
  readonly makeRequest: (id: string, input: Input) => Request;
  readonly resolveBeforeInstall?: (input: Input) => Option.Option<Value>;
  readonly rejectOnShutdown: (
    request: Request,
  ) => PendingRequestFailure<Failure, Event>;
  readonly snapshotRequest?: (request: Request) => Request;
}

export interface PendingRequestRegistry<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  readonly ask: (input: Input) => Effect.Effect<Value, Failure>;
  readonly events: Stream.Stream<Event>;
  readonly fail: <NotFound, MakeFailure>(
    requestID: string,
    notFound: NotFound,
    makeFailure: (
      request: Request,
    ) => Effect.Effect<PendingRequestFailure<Failure, Event>, MakeFailure>,
  ) => Effect.Effect<void, NotFound | MakeFailure>;
  readonly list: () => Effect.Effect<ReadonlyArray<Request>>;
  readonly succeed: <NotFound, MakeFailure>(
    requestID: string,
    notFound: NotFound,
    makeSuccess: (
      request: Request,
    ) => Effect.Effect<PendingRequestSuccess<Value, Event>, MakeFailure>,
  ) => Effect.Effect<void, NotFound | MakeFailure>;
}
