import type { Provider } from "../provider/provider";
import type { Tool } from "../tools/tools";
import { assertUniqueToolNames } from "./assert-unique-tool-names";
import type { CollectedExtensions, Extension } from "./extension";
import { makeExtensionApi } from "./make-extension-api";

export const collectExtensions = async (
  extensions: readonly Extension[],
): Promise<CollectedExtensions> => {
  let provider: Provider | undefined;
  const tools: Tool[] = [];
  const observers: CollectedExtensions["observers"] extends readonly (infer T)[]
    ? T[]
    : never = [];
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
};
