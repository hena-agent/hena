import { Effect } from "effect";
import type { ProviderChunk } from "../provider/provider";
import type { CoreServices } from "../services/services";
import { emit } from "../state/emit";
import type { SessionState } from "../state/state";
import { appendProviderPart } from "./append-provider-part";
import type { TurnAccumulator } from "./turn-stream";

export const applyChunk = (
  state: SessionState,
  accumulator: TurnAccumulator,
  chunk: ProviderChunk,
): Effect.Effect<void, never, CoreServices> => {
  if (chunk.type === "finish") {
    return Effect.sync(() => {
      accumulator.error =
        chunk.stopReason === "error" ? chunk.error : undefined;
      accumulator.stopReason = chunk.stopReason;
      accumulator.usage = chunk.usage;
    });
  }
  appendProviderPart(accumulator, chunk);
  if (chunk.type === "tool_call") {
    return Effect.succeed(undefined);
  }
  return Effect.map(
    emit(state, { text: chunk.text, type: "message_delta" }),
    () => undefined,
  );
};
