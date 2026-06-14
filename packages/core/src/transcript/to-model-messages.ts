import type { ModelMessage } from "../provider/provider";
import type { TranscriptEntry } from "./transcript";

export const toModelMessages = (
  transcript: readonly TranscriptEntry[],
): readonly ModelMessage[] => {
  const toModelMessage = (entry: TranscriptEntry): ModelMessage => {
    if (entry.role === "user") {
      return { content: entry.content, role: "user" };
    }
    if (entry.role === "tool_result") {
      return {
        content: entry.content.text,
        isError: entry.isError,
        role: "tool",
        toolCallId: entry.toolCallId,
      };
    }
    return { parts: entry.parts, role: "assistant" };
  };

  return transcript.map(toModelMessage);
};
