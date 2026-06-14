import type { CoreEvent, CoreEventType } from "./events";
import type { Provider } from "./provider";
import type { Tool } from "./tools";

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

export async function collectExtensions(
  extensions: readonly Extension[],
): Promise<CollectedExtensions> {
  let provider: Provider | undefined;
  const tools: Tool[] = [];
  const observers: EventObserver[] = [];
  const api = makeExtensionApi({
    observers,
    setProvider: (next: Provider): void => {
      provider = next;
    },
    tools,
  });
  for (const setup of extensions) {
    await setup(api);
  }
  return { observers, provider, tools };
}

type MutableRegistrations = {
  readonly observers: EventObserver[];
  readonly setProvider: (provider: Provider) => void;
  readonly tools: Tool[];
};

function makeExtensionApi(registrations: MutableRegistrations): ExtensionAPI {
  return {
    on: (
      type: CoreEventType | "event",
      handler: (event: CoreEvent) => Promise<void> | void,
    ): void => {
      registrations.observers.push({ handler, type });
    },
    provideProvider: registrations.setProvider,
    registerTool: (tool: Tool): void => {
      registrations.tools.push(tool);
    },
  };
}
