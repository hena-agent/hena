import type { ToolRun } from "./dispatch";

export const errorRun = (message: string): ToolRun => ({
  output: { text: message, type: "text" },
  type: "error",
});
