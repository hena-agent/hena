import { Schema } from "effect";

import { NonNegativeIntBase, RunId } from "../domain/primitives";
import { EventBaseFields } from "./common";

export const RunStartEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("run-start"),
  parentRunId: Schema.optionalKey(RunId),
}).annotate({ identifier: "RunStartEvent" });
export type RunStartEvent = Schema.Schema.Type<typeof RunStartEvent>;

export const RunEndEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("run-end"),
  reason: Schema.Literals(["stop", "aborted", "error", "max-steps"]),
}).annotate({ identifier: "RunEndEvent" });
export type RunEndEvent = Schema.Schema.Type<typeof RunEndEvent>;

export const TurnStartEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("turn-start"),
  step: NonNegativeIntBase,
}).annotate({ identifier: "TurnStartEvent" });
export type TurnStartEvent = Schema.Schema.Type<typeof TurnStartEvent>;

export const TurnEndEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("turn-end"),
  step: NonNegativeIntBase,
}).annotate({ identifier: "TurnEndEvent" });
export type TurnEndEvent = Schema.Schema.Type<typeof TurnEndEvent>;
