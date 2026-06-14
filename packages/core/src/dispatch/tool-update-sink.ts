import type { ToolOutput } from "../common/common";

export type ToolUpdateSink = {
  readonly close: () => Promise<void>;
  readonly update: (partial: ToolOutput) => Promise<void>;
};
