import type { Extension, ExtensionAPI } from "../extensions/extension";
import type { ProviderRequest } from "../provider/provider";
import { chunkStream } from "./streams";

export const toolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            { text: "calling double", type: "text_delta" },
            {
              toolCall: { id: "call_1", input: { value: 5 }, name: "double" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "tool returned 10", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};

export const unknownToolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "missing" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "continued", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};

export const abortableToolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: (request: ProviderRequest) => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "wait-for-abort" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          {
            stopReason: request.signal.aborted ? "aborted" : "completed",
            type: "finish",
          },
        ]);
      },
    });
  };
};

export const abortThrowingToolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "throw-on-abort" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([{ stopReason: "completed", type: "finish" }]);
      },
    });
  };
};

export const loopingToolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        return chunkStream([
          {
            toolCall: { id: `call_${calls}`, input: {}, name: "noop" },
            type: "tool_call",
          },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};
