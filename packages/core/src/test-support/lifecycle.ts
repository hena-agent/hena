import type { ToolOutput } from "../common/common";
import type { Extension, ExtensionAPI } from "../extensions/extension";
import type { ProviderChunk } from "../provider/provider";
import { chunkStream } from "./streams";

export const lateUpdateProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "late_1", input: {}, name: "late-update" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "late update complete", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};

export const uncooperativeToolProvider = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          {
            toolCall: { id: "never_1", input: {}, name: "never" },
            type: "tool_call",
          },
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
};

export const uncooperativeTool = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Never resolves and ignores abort.",
      execute: async (): Promise<ToolOutput> => {
        await new Promise<never>(() => undefined);
        return { text: "unreachable", type: "text" };
      },
      name: "never",
      parameters: { type: "object" },
    });
  };
};

export const uncooperativeCleanupProvider = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => ({
        [Symbol.asyncIterator]: () => {
          let started = false;
          return {
            next: async (): Promise<IteratorResult<ProviderChunk>> => {
              if (!started) {
                started = true;
                return {
                  done: false,
                  value: { text: "partial", type: "text_delta" },
                };
              }
              await new Promise<never>(() => undefined);
              return { done: true, value: undefined };
            },
            return: async (): Promise<IteratorResult<ProviderChunk>> => {
              await Promise.resolve();
              throw new Error("cleanup failed");
            },
          };
        },
      }),
    });
  };
};
