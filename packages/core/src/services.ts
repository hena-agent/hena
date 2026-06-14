import { Context, Layer } from "effect";
import {
  type EventSessions,
  eventSessionIterable,
  publishEventToSession,
  registerEventSession,
  unregisterEventSession,
} from "./event-log";
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
  readonly publish: (event: CoreEvent) => void;
  readonly register: (sessionId: string) => void;
  readonly stream: (sessionId: string) => AsyncIterable<CoreEvent>;
  readonly unregister: (sessionId: string) => void;
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
  return Layer.sync(EventBus, () => {
    const sessions: EventSessions = new Map();
    return EventBus.of({
      register: (sessionId: string) => {
        registerEventSession(sessions, sessionId);
      },
      publish: (event: CoreEvent) => {
        publish(sessions, observers, event);
      },
      stream: (sessionId: string) => eventSessionIterable(sessions, sessionId),
      unregister: (sessionId: string) => {
        unregisterEventSession(sessions, sessionId);
      },
    });
  });
}

function publish(
  sessions: EventSessions,
  observers: readonly EventObserver[],
  event: CoreEvent,
): void {
  publishEventToSession(sessions, event);
  notifyObservers(observers, event);
}

function notifyObservers(
  observers: readonly EventObserver[],
  event: CoreEvent,
): void {
  const targets = observers.filter((observer) => wantsEvent(observer, event));
  for (const observer of targets) {
    void notifyObserver(observer, event);
  }
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
