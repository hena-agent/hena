import { Effect } from "effect";
import type { StopReason } from "./common";
import { dispatchToolCalls } from "./dispatch";
import type { CoreServices } from "./services";
import { appendPrompt, emit, type SessionState } from "./state";
import type { AssistantEntry } from "./transcript";
import { runTurn } from "./turn";

type TurnOutcome = {
  readonly reason: StopReason;
  readonly shouldContinue: boolean;
};

type LoopState = {
  readonly reason: StopReason;
  readonly running: boolean;
};

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
    while (running && !signal.aborted) {
      const turn = yield* runOneTurn(state, signal);
      turns += 1;
      const next = nextLoopState(turn, turns, maxTurns);
      reason = next.reason;
      running = next.running;
    }
    if (signal.aborted) {
      reason = "aborted";
    }
    yield* emit(state, { reason, type: "agent_end" });
  });
}

function nextLoopState(
  turn: TurnOutcome,
  turns: number,
  maxTurns: number,
): LoopState {
  if (turn.shouldContinue && turns >= maxTurns) {
    return { reason: "max_turns", running: false };
  }
  return { reason: turn.reason, running: turn.shouldContinue };
}

function runOneTurn(
  state: SessionState,
  signal: AbortSignal,
): Effect.Effect<TurnOutcome, never, CoreServices> {
  return Effect.gen(function* () {
    yield* emit(state, { type: "turn_start" });
    const assistant = yield* runTurn(state, signal);
    let reason = nextReason(assistant);
    let shouldContinue = shouldContinueAfterAssistant(assistant);
    if (
      assistant.toolCalls.length > 0 &&
      assistant.stopReason === "completed"
    ) {
      const dispatch = yield* dispatchToolCalls(
        state,
        assistant.toolCalls,
        signal,
      );
      if (dispatch.type === "aborted") {
        reason = "aborted";
        shouldContinue = false;
      }
    }
    yield* emit(state, { type: "turn_end", usage: assistant.usage });
    return { reason, shouldContinue };
  });
}

function nextReason(assistant: AssistantEntry): StopReason {
  if (assistant.stopReason === "error" || assistant.stopReason === "aborted") {
    return assistant.stopReason;
  }
  return "completed";
}

function shouldContinueAfterAssistant(assistant: AssistantEntry): boolean {
  return assistant.stopReason === "completed" && assistant.toolCalls.length > 0;
}
