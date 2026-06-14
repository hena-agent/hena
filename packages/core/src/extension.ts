import type { CoreEvent, CoreEventType } from "./events";
import type { Provider } from "./provider";
import { isStandardSchema, type Tool } from "./tools";

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
  let open = true;
  const api = makeExtensionApi({
    isOpen: () => open,
    observers,
    setProvider: (next: Provider): void => {
      provider = next;
    },
    tools,
  });
  try {
    for (const setup of extensions) {
      await setup(api);
    }
  } finally {
    open = false;
  }
  assertUniqueToolNames(tools);
  return { observers: [...observers], provider, tools: [...tools] };
}

type MutableRegistrations = {
  readonly isOpen: () => boolean;
  readonly observers: EventObserver[];
  readonly setProvider: (provider: Provider) => void;
  readonly tools: Tool[];
};

function assertUniqueToolNames(tools: readonly Tool[]): void {
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }
}

function makeExtensionApi(registrations: MutableRegistrations): ExtensionAPI {
  return {
    on: (
      type: CoreEventType | "event",
      handler: (event: CoreEvent) => Promise<void> | void,
    ): void => {
      assertRegistrationOpen(registrations);
      registrations.observers.push({ handler, type });
    },
    provideProvider: (provider: Provider): void => {
      assertRegistrationOpen(registrations);
      registrations.setProvider(provider);
    },
    registerTool: (tool: Tool): void => {
      assertRegistrationOpen(registrations);
      assertProviderSchema(tool);
      registrations.tools.push(tool);
    },
  };
}

function assertProviderSchema(tool: Tool): void {
  if (isStandardSchema(tool.parameters) && tool.schema === undefined) {
    throw new Error(
      `Standard-schema tool requires provider schema: ${tool.name}`,
    );
  }
}

function assertRegistrationOpen(registrations: MutableRegistrations): void {
  if (!registrations.isOpen()) {
    throw new Error("Extension registration is closed");
  }
}
