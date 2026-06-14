import type { ToolOutput } from "../common/common";

export type ToolDispatchResult = { readonly type: "completed" | "aborted" };

export type ToolRun = {
  readonly output: ToolOutput;
  readonly type: "success" | "error" | "aborted";
};

export type ExecuteToolOptions = {
  readonly input: unknown;
  readonly signal: AbortSignal;
};
