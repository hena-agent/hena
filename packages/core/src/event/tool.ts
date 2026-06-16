import { Schema } from "effect";

import { JsonValue, ToolCallId, ToolName } from "../domain/primitives";
import { EventBaseFields } from "./common";

export const ToolInputStartEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-input-start"),
  toolCallId: ToolCallId,
  name: ToolName,
}).annotate({ identifier: "ToolInputStartEvent" });
export type ToolInputStartEvent = Schema.Schema.Type<
  typeof ToolInputStartEvent
>;

export const ToolInputDeltaEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-input-delta"),
  toolCallId: ToolCallId,
  delta: Schema.String,
}).annotate({ identifier: "ToolInputDeltaEvent" });
export type ToolInputDeltaEvent = Schema.Schema.Type<
  typeof ToolInputDeltaEvent
>;

export const ToolInputEndEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-input-end"),
  toolCallId: ToolCallId,
}).annotate({ identifier: "tool-input-end" });
export type ToolInputEndEvent = Schema.Schema.Type<typeof ToolInputEndEvent>;

export const ToolCallEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-call"),
  toolCallId: ToolCallId,
  name: ToolName,
  input: JsonValue,
}).annotate({ identifier: "ToolCallEvent" });
export type ToolCallEvent = Schema.Schema.Type<typeof ToolCallEvent>;

export const ToolExecutionStartEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-execution-start"),
  toolCallId: ToolCallId,
}).annotate({ identifier: "ToolExecutionStartEvent" });
export type ToolExecutionStartEvent = Schema.Schema.Type<
  typeof ToolExecutionStartEvent
>;

export const ToolExecutionDeltaEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-execution-delta"),
  toolCallId: ToolCallId,
  chunk: JsonValue,
}).annotate({ identifier: "ToolExecutionDeltaEvent" });
export type ToolExecutionDeltaEvent = Schema.Schema.Type<
  typeof ToolExecutionDeltaEvent
>;

export const ToolExecutionEndEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-execution-end"),
  toolCallId: ToolCallId,
}).annotate({ identifier: "ToolExecutionEndEvent" });
export type ToolExecutionEndEvent = Schema.Schema.Type<
  typeof ToolExecutionEndEvent
>;

export const ToolResultEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("tool-result"),
  toolCallId: ToolCallId,
  output: JsonValue,
  isError: Schema.Boolean,
}).annotate({ identifier: "ToolResultEvent" });
export type ToolResultEvent = Schema.Schema.Type<typeof ToolResultEvent>;
