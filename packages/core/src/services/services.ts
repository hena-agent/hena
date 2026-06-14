import { Context } from "effect";
import type { CoreEvent } from "../events/events";
import type { Provider } from "../provider/provider";
import type { Tool } from "../tools/tools";

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
export type EventBusId = { readonly EventBus: unique symbol };

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
