import type { StopReason } from "../common/common";
import type { AssistantEntry } from "../transcript/transcript";

export const nextReason = (assistant: AssistantEntry): StopReason => {
  if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
    return assistant.stopReason;
  }
  return "completed";
};
