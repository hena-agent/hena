import type { TurnAccumulator } from "./turn-stream";

export const emptyAccumulator = (): TurnAccumulator => ({
  error: undefined,
  parts: [],
  stopReason: "completed",
  toolCalls: [],
  usage: undefined,
});
