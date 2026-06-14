import type { ToolOutput } from "../common/common";
import type { Extension, ExtensionAPI } from "../extensions/extension";
import type { ToolContext } from "../tools/tools";
import { waitForAbort } from "./streams";

export const abortThrowingTool = (): Extension => {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Throws an AbortError after the session is aborted.",
      execute: async (
        _input: unknown,
        context: ToolContext,
      ): Promise<ToolOutput> => {
        await waitForAbort(context.signal);
        const error = new Error("tool aborted");
        error.name = "AbortError";
        throw error;
      },
      name: "throw-on-abort",
      parameters: { type: "object" },
    });
  };
};
