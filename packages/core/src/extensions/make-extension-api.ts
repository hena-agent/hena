import type { CoreEvent, CoreEventType } from "../events/events";
import type { Provider } from "../provider/provider";
import type { Tool } from "../tools/tools";
import { assertProviderSchema } from "./assert-provider-schema";
import { assertRegistrationOpen } from "./assert-registration-open";
import type { ExtensionAPI, MutableRegistrations } from "./extension";

export const makeExtensionApi = (
  registrations: MutableRegistrations,
): ExtensionAPI => ({
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
});
