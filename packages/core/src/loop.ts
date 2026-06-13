import { Effect } from "effect";
import type { StopReason } from "./common";
import { dispatchToolCalls } from "./dispatch";
import type { CoreServices } from "./services";
import { appendPrompt, emit, type SessionState } from "./state";
import type { AssistantEntry } from "./transcript";
import { runTurn } from "./turn";

export function runPromptLoop(
  state: SessionState,
  content: string,
  signal: AbortSignal,
  maxTurns: number,
): Effect.Effect<void, never, CoreServices> {
  return Effect.gen(function* () {
    yield* appendPrompt(state, content);
    yield* emit(state, { type: "agent_start" });
    let reason: StopReason = "completed";
    let turns = 0;
    let running = true;
    while (running) {
      const assistant = yield* runOneTurn(state, signal);
      turns += 1;
      reason = nextReason(assistant);
      running = shouldContinue(assistant);
      if (running && turns >= maxTurns) {
        reason = "max_turns";
        running = false;
      }
    }
    yield* emit(state, { reason, type: "agent_end" });
  });
}

function runOneTurn(
  state: SessionState,
  signal: AbortSignal,
): Effect.Effect<AssistantEntry, never, CoreServices> {
  return Effect.gen(function* () {
    yield* emit(state, { type: "turn_start" });
    const assistant = yield* runTurn(state, signal);
    if (
      assistant.toolCalls.length > 0 &&
      assistant.stopReason === "completed"
    ) {
      yield* dispatchToolCalls(state, assistant.toolCalls, signal);
    }
    yield* emit(state, { type: "turn_end", usage: assistant.usage });
    return assistant;
  });
}

function nextReason(assistant: AssistantEntry): StopReason {
  if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
    return assistant.stopReason;
  }
  return "completed";
}

function shouldContinue(assistant: AssistantEntry): boolean {
  return assistant.stopReason === "completed" && assistant.toolCalls.length > 0;
}
