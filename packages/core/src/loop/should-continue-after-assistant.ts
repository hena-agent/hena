import type { AssistantEntry } from "../transcript/transcript";

export const shouldContinueAfterAssistant = (
  assistant: AssistantEntry,
): boolean =>
  assistant.stopReason === "completed" && assistant.toolCalls.length > 0;
