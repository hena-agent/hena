import type { ProviderChunk } from "../provider/provider";
import type { TurnAccumulator } from "./turn-stream";

export const appendProviderPart = (
  accumulator: TurnAccumulator,
  chunk: Exclude<ProviderChunk, { readonly type: "finish" }>,
): void => {
  if (chunk.type === "tool_call") {
    accumulator.parts.push({ toolCall: chunk.toolCall, type: "tool_call" });
    accumulator.toolCalls.push(chunk.toolCall);
    return;
  }
  const previous = accumulator.parts.at(-1);
  if (previous?.type === "text") {
    accumulator.parts[accumulator.parts.length - 1] = {
      text: `${previous.text}${chunk.text}`,
      type: "text",
    };
    return;
  }
  accumulator.parts.push({ text: chunk.text, type: "text" });
};
