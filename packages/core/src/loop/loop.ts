import type { StopReason } from "../common/common";

export type TurnOutcome = {
  readonly reason: StopReason;
  readonly shouldContinue: boolean;
};

export type LoopState = {
  readonly reason: StopReason;
  readonly running: boolean;
};
