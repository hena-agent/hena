import { Effect, PubSub } from "effect";
import type {
  RequestLifecycleContext,
  SettlePendingRequestContext,
} from "./contexts";
import { askPendingRequest, rejectEntries } from "./lifecycle";
import type {
  PendingRequestMap,
  PendingRequestRegistryOptions,
  PendingRequestSettlement,
} from "./types";

export class PendingRequestRegistryState<
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
> {
  private nextID = 0;
  private readonly pending: PendingRequestMap<Request, Value, Failure> =
    new Map();

  constructor(
    private readonly options: PendingRequestRegistryOptions<
      Input,
      Request,
      Failure,
      Event
    >,
    private readonly events: PubSub.PubSub<Event>,
  ) {}

  ask(input: Input): Effect.Effect<Value, Failure> {
    return askPendingRequest(this.lifecycleContext(), input);
  }

  list(): Effect.Effect<ReadonlyArray<Request>> {
    return Effect.sync(() =>
      Array.from(this.pending.values(), (entry) => entry.request),
    );
  }

  close(): Effect.Effect<void> {
    const entries = Array.from(this.pending.values());
    this.pending.clear();
    return rejectEntries(this.lifecycleContext(), entries).pipe(
      Effect.andThen(PubSub.shutdown(this.events)),
      Effect.asVoid,
    );
  }

  settlementContext(): SettlePendingRequestContext<
    Request,
    Value,
    Failure,
    Event
  > {
    return {
      pending: this.pending,
      publishSettlement: this.publishSettlement.bind(this),
    };
  }

  private lifecycleContext(): RequestLifecycleContext<
    Input,
    Request,
    Value,
    Failure,
    Event
  > {
    return {
      allocateID: this.allocateID.bind(this),
      options: this.options,
      pending: this.pending,
      publish: this.publish.bind(this),
      publishSettlement: this.publishSettlement.bind(this),
    };
  }

  private allocateID(): string {
    const id = `${this.options.idPrefix}-${this.nextID}`;
    this.nextID += 1;
    return id;
  }

  private publish(event: Event): Effect.Effect<void> {
    return PubSub.publish(this.events, event).pipe(Effect.asVoid);
  }

  private publishSettlement(
    settlement: PendingRequestSettlement<Event>,
  ): Effect.Effect<void> {
    return (settlement.commit ?? Effect.void).pipe(
      Effect.andThen(this.publish(settlement.event)),
      Effect.asVoid,
    );
  }
}
