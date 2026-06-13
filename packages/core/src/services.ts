import { Context, Effect, Layer, PubSub, Stream } from "effect";
import type { CoreEvent } from "./events";
import type { EventObserver } from "./extension";
import type { Provider } from "./provider";
import type { Tool } from "./tools";

export type ProviderService = Provider;

export type ToolRegistryService = {
  readonly get: (name: string) => Tool | undefined;
  readonly list: () => readonly Tool[];
};

export type EventBusService = {
  readonly publish: (event: CoreEvent) => Effect.Effect<void>;
  readonly stream: (
    sessionId: string,
  ) => Effect.Effect<Stream.Stream<CoreEvent>>;
};

type ProviderId = { readonly ProviderPort: unique symbol };
type ToolRegistryId = { readonly ToolRegistry: unique symbol };
type EventBusId = { readonly EventBus: unique symbol };

export type CoreServices = ProviderId | ToolRegistryId | EventBusId;

export const ProviderPort = Context.Service<ProviderId, ProviderService>(
  "hena/core/ProviderPort",
);

export const ToolRegistry = Context.Service<
  ToolRegistryId,
  ToolRegistryService
>("hena/core/ToolRegistry");

export const EventBus = Context.Service<EventBusId, EventBusService>(
  "hena/core/EventBus",
);

export function makeCoreLayer(
  provider: Provider,
  tools: readonly Tool[],
  observers: readonly EventObserver[],
): Layer.Layer<CoreServices> {
  return Layer.mergeAll(
    Layer.succeed(ProviderPort, provider),
    Layer.succeed(ToolRegistry, makeToolRegistry(tools)),
    makeEventBusLayer(observers),
  );
}

function makeToolRegistry(tools: readonly Tool[]): ToolRegistryService {
  return {
    get: (name: string) => tools.find((tool: Tool) => tool.name === name),
    list: () => tools,
  };
}

function makeEventBusLayer(
  observers: readonly EventObserver[],
): Layer.Layer<EventBusId> {
  return Layer.effect(
    EventBus,
    Effect.gen(function* () {
      const sessions = new Map<string, PubSub.PubSub<CoreEvent>>();
      yield* Effect.addFinalizer(() => shutdownSessions(sessions));
      return EventBus.of({
        publish: (event: CoreEvent) => publish(sessions, observers, event),
        stream: (sessionId: string) => sessionStream(sessions, sessionId),
      });
    }),
  );
}

function shutdownSessions(
  sessions: Map<string, PubSub.PubSub<CoreEvent>>,
): Effect.Effect<void> {
  return Effect.gen(function* () {
    for (const pubsub of sessions.values()) {
      yield* PubSub.shutdown(pubsub);
    }
  });
}

function sessionStream(
  sessions: Map<string, PubSub.PubSub<CoreEvent>>,
  sessionId: string,
): Effect.Effect<Stream.Stream<CoreEvent>> {
  return Effect.map(sessionPubSub(sessions, sessionId), Stream.fromPubSub);
}

function sessionPubSub(
  sessions: Map<string, PubSub.PubSub<CoreEvent>>,
  sessionId: string,
): Effect.Effect<PubSub.PubSub<CoreEvent>> {
  const existing = sessions.get(sessionId);
  if (existing !== undefined) {
    return Effect.succeed(existing);
  }
  return Effect.map(PubSub.unbounded<CoreEvent>({ replay: 256 }), (pubsub) => {
    sessions.set(sessionId, pubsub);
    return pubsub;
  });
}

function publish(
  sessions: Map<string, PubSub.PubSub<CoreEvent>>,
  observers: readonly EventObserver[],
  event: CoreEvent,
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const pubsub = yield* sessionPubSub(sessions, event.sessionId);
    yield* PubSub.publish(pubsub, event);
    yield* notifyObservers(observers, event);
  });
}

function notifyObservers(
  observers: readonly EventObserver[],
  event: CoreEvent,
): Effect.Effect<void> {
  const targets = observers.filter((observer) => wantsEvent(observer, event));
  if (targets.length === 0) {
    return Effect.succeed(undefined);
  }
  return Effect.promise(async () => {
    await Promise.all(
      targets.map(async (observer: EventObserver) => {
        await notifyObserver(observer, event);
      }),
    );
  });
}

async function notifyObserver(
  observer: EventObserver,
  event: CoreEvent,
): Promise<void> {
  try {
    await observer.handler(event);
  } catch {
    return undefined;
  }
}

function wantsEvent(observer: EventObserver, event: CoreEvent): boolean {
  return observer.type === "event" || observer.type === event.type;
}
