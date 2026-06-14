import { Effect } from "effect";
import type { StopReason } from "../common/common";
import type { CoreServices } from "../services/services";
import { appendPrompt } from "../state/append-prompt";
import { emit } from "../state/emit";
import type { SessionState } from "../state/state";
import { nextLoopState } from "./next-loop-state";
import { runOneTurn } from "./run-one-turn";

export const runPromptLoop = (
  state: SessionState,
  content: string,
  signal: AbortSignal,
  maxTurns: number,
): Effect.Effect<void, never, CoreServices> =>
  Effect.gen(function* () {
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
