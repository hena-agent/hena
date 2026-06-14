import type { CoreEvent, CoreEventType } from "../events/events";
import type { Provider } from "../provider/provider";
import type { Tool } from "../tools/tools";

export type EventObserver = {
  readonly handler: (event: CoreEvent) => Promise<void> | void;
  readonly type: CoreEventType | "event";
};

export type ExtensionAPI = {
  readonly on: (
    type: CoreEventType | "event",
    handler: (event: CoreEvent) => Promise<void> | void,
  ) => void;
  readonly provideProvider: (provider: Provider) => void;
  readonly registerTool: (tool: Tool) => void;
};

export type Extension = (api: ExtensionAPI) => Promise<void> | void;

export type CollectedExtensions = {
  readonly observers: readonly EventObserver[];
  readonly provider: Provider | undefined;
  readonly tools: readonly Tool[];
};

export type MutableRegistrations = {
  readonly isOpen: () => boolean;
  readonly observers: EventObserver[];
  readonly setProvider: (provider: Provider) => void;
  readonly tools: Tool[];
};
