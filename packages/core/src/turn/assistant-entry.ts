import { Effect } from "effect";
import { nextEntryId } from "../state/next-entry-id";
import { now } from "../state/now";
import type { SessionState } from "../state/state";
import type { AssistantEntry } from "../transcript/transcript";
import type { TurnAccumulator } from "./turn-stream";

export const assistantEntry = (
  state: SessionState,
  accumulator: TurnAccumulator,
): Effect.Effect<AssistantEntry> =>
  Effect.map(nextEntryId(state), (id) => ({
    error: accumulator.error,
    id,
    parts: accumulator.parts,
    role: "assistant",
    stopReason: accumulator.stopReason,
    timestamp: now(),
    toolCalls: accumulator.toolCalls,
    usage: accumulator.usage,
  }));
