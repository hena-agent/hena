import { Effect } from "effect";
import {
  type CoreServices,
  ProviderPort,
  ToolRegistry,
} from "../services/services";
import { appendEntry } from "../state/append-entry";
import { emit } from "../state/emit";
import type { SessionState } from "../state/state";
import { transcriptSnapshot } from "../state/transcript-snapshot";
import { toolDefinition } from "../tools/tool-definition";
import { toModelMessages } from "../transcript/to-model-messages";
import type { AssistantEntry } from "../transcript/transcript";
import { assistantEntry } from "./assistant-entry";
import { consumeProviderStream } from "./consume-provider-stream";

export const runTurn = (
  state: SessionState,
  signal: AbortSignal,
): Effect.Effect<AssistantEntry, never, CoreServices> =>
  Effect.gen(function* () {
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
