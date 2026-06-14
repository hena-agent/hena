import { Effect } from "effect";
import { dispatchToolCalls } from "../dispatch/dispatch-tool-calls";
import type { CoreServices } from "../services/services";
import { emit } from "../state/emit";
import type { SessionState } from "../state/state";
import { runTurn } from "../turn/run-turn";
import type { TurnOutcome } from "./loop";
import { nextReason } from "./next-reason";
import { shouldContinueAfterAssistant } from "./should-continue-after-assistant";

export const runOneTurn = (
  state: SessionState,
  signal: AbortSignal,
): Effect.Effect<TurnOutcome, never, CoreServices> =>
  Effect.gen(function* () {
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
