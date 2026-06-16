import { Schema } from "effect";

import { NonNegativeIntBase, RunId } from "../domain/primitives";
import { defineEvent } from "./common";

export const RunStartEvent = defineEvent("run-start", {
  parentRunId: Schema.optionalKey(RunId),
});
export type RunStartEvent = Schema.Schema.Type<typeof RunStartEvent>;

export const RunEndEvent = defineEvent("run-end", {
  reason: Schema.Literals(["stop", "aborted", "error", "max-steps"]),
});
export type RunEndEvent = Schema.Schema.Type<typeof RunEndEvent>;

export const TurnStartEvent = defineEvent("turn-start", {
  step: NonNegativeIntBase,
});
export type TurnStartEvent = Schema.Schema.Type<typeof TurnStartEvent>;

export const TurnEndEvent = defineEvent("turn-end", {
  step: NonNegativeIntBase,
});
export type TurnEndEvent = Schema.Schema.Type<typeof TurnEndEvent>;

export const LifecycleEvents = [
  RunStartEvent,
  RunEndEvent,
  TurnStartEvent,
  TurnEndEvent,
] as const;
