import { Effect } from "effect";
import { type CoreServices, ProviderPort, ToolRegistry } from "./services";
import {
  appendEntry,
  emit,
  nextEntryId,
  now,
  type SessionState,
  transcriptSnapshot,
} from "./state";
import { toolDefinition } from "./tools";
import { type AssistantEntry, toModelMessages } from "./transcript";
import { consumeProviderStream, type TurnAccumulator } from "./turn-stream";

export function runTurn(
  state: SessionState,
  signal: AbortSignal,
): Effect.Effect<AssistantEntry, never, CoreServices> {
  return Effect.gen(function* () {
    const provider = yield* ProviderPort;
    const registry = yield* ToolRegistry;
    const transcript = yield* transcriptSnapshot(state);
    const request = {
      messages: toModelMessages(transcript),
      signal,
      tools: registry.list().map(toolDefinition),
    };
    yield* emit(state, { type: "message_start" });
    const accumulator = yield* consumeProviderStream(
      state,
      () => provider.stream(request),
      signal,
    );
    const entry = yield* assistantEntry(state, accumulator);
    yield* appendEntry(state, entry);
    yield* emit(state, { entry, type: "message_end" });
    return entry;
  });
}

function assistantEntry(
  state: SessionState,
  accumulator: TurnAccumulator,
): Effect.Effect<AssistantEntry> {
  return Effect.map(nextEntryId(state), (id) => ({
    error: accumulator.error,
    id,
    parts: accumulator.parts,
    role: "assistant",
    stopReason: accumulator.stopReason,
    timestamp: now(),
    toolCalls: accumulator.toolCalls,
    usage: accumulator.usage,
  }));
}
