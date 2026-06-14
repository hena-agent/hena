import type { Extension, ExtensionAPI } from "../extensions/extension";
import type { ProviderChunk, ProviderRequest } from "../provider/provider";
import { waitForAbort } from "./streams";

export const abortableProvider = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: async function* (
        request: ProviderRequest,
      ): AsyncGenerator<ProviderChunk> {
        yield { text: "partial", type: "text_delta" };
        await waitForAbort(request.signal);
        yield { stopReason: "aborted", type: "finish" };
      },
    });
  };
};

export const abortErrorProvider = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: async function* (
        request: ProviderRequest,
      ): AsyncGenerator<ProviderChunk> {
        yield { text: "partial", type: "text_delta" };
        await waitForAbort(request.signal);
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      },
    });
  };
};

export const uncooperativeProvider = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: async function* (): AsyncGenerator<ProviderChunk> {
        yield { text: "started", type: "text_delta" };
        await new Promise<never>(() => undefined);
      },
    });
  };
};
