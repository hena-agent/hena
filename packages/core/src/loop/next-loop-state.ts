import type { LoopState, TurnOutcome } from "./loop";

export const nextLoopState = (
  turn: TurnOutcome,
  turns: number,
  maxTurns: number,
): LoopState => {
  if (turn.shouldContinue && turns >= maxTurns) {
    return { reason: "max_turns", running: false };
  }
  return { reason: turn.reason, running: turn.shouldContinue };
};
