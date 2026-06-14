import type { ToolRun } from "./dispatch";

export const abortedRun = (message: string): ToolRun => ({
  output: { text: message, type: "text" },
  type: "aborted",
});
