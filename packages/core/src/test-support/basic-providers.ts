import type { Extension, ExtensionAPI } from "../extensions/extension";
import type { ProviderChunk, ProviderRequest } from "../provider/provider";
import type { ToolDefinition } from "../tools/tools";
import { chunkStream, throwingStream } from "./streams";

export const textProvider = (text: string): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          { text, type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
};

export const multiTextProvider = (chunks: readonly string[]): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          ...chunks.map((text) => ({ text, type: "text_delta" }) as const),
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
};

export const providerWithFinally = (onClose: () => void): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: async function* (): AsyncGenerator<ProviderChunk> {
        try {
          await Promise.resolve();
          yield { text: "done", type: "text_delta" };
          yield { stopReason: "completed", type: "finish" };
        } finally {
          onClose();
        }
      },
    });
  };
};

export const providerWithFailingCleanup = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: async function* (): AsyncGenerator<ProviderChunk> {
        try {
          await Promise.resolve();
          yield { stopReason: "completed", type: "finish" };
        } finally {
          await failingCleanup();
        }
      },
    });
  };
};

const failingCleanup = async (): Promise<void> => {
  await Promise.reject(new Error("cleanup failed"));
};

export const providerError = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          {
            error: { category: "api", message: "provider failed" },
            stopReason: "error",
            type: "finish",
          },
        ]),
    });
  };
};

export const providerThrows = (error: Error): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => throwingStream(error),
    });
  };
};

export const providerStreamCreationThrows = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        throw new Error("stream setup failed");
      },
    });
  };
};

export const providerEndsWithoutFinish = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () =>
        chunkStream([{ text: "done by iterator", type: "text_delta" }]),
    });
  };
};

export const capturingProvider = (seen: ToolDefinition[][]): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: (request: ProviderRequest) => {
        seen.push([...request.tools]);
        return chunkStream([
          { text: "schemas", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};
