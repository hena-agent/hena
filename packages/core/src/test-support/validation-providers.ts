import type { Extension, ExtensionAPI } from "../extensions/extension";
import { chunkStream } from "./streams";

export const validationProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "valid", input: { value: 3 }, name: "triple" },
              type: "tool_call",
            },
            {
              toolCall: { id: "message", input: {}, name: "triple" },
              type: "tool_call",
            },
            {
              toolCall: {
                id: "fallback",
                input: { fallback: true },
                name: "triple",
              },
              type: "tool_call",
            },
            {
              toolCall: { id: "boom", input: {}, name: "schema-boom" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "validated", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};

export const failingToolProvider = (): Extension => {
  let calls = 0;
  return (api: ExtensionAPI): void => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "boom" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "saw tool failure", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
};
