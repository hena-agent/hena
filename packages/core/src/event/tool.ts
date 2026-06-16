import { Schema } from "effect";

import { JsonValue, ToolCallId, ToolName } from "../domain/primitives";
import { defineEvent } from "./common";

export const ToolInputStartEvent = defineEvent("tool-input-start", {
  toolCallId: ToolCallId,
  name: ToolName,
});
export type ToolInputStartEvent = Schema.Schema.Type<
  typeof ToolInputStartEvent
>;

export const ToolInputDeltaEvent = defineEvent("tool-input-delta", {
  toolCallId: ToolCallId,
  delta: Schema.String,
});
export type ToolInputDeltaEvent = Schema.Schema.Type<
  typeof ToolInputDeltaEvent
>;

export const ToolInputEndEvent = defineEvent("tool-input-end", {
  toolCallId: ToolCallId,
});
export type ToolInputEndEvent = Schema.Schema.Type<typeof ToolInputEndEvent>;

export const ToolCallEvent = defineEvent("tool-call", {
  toolCallId: ToolCallId,
  name: ToolName,
  input: JsonValue,
});
export type ToolCallEvent = Schema.Schema.Type<typeof ToolCallEvent>;

export const ToolExecutionStartEvent = defineEvent("tool-execution-start", {
  toolCallId: ToolCallId,
});
export type ToolExecutionStartEvent = Schema.Schema.Type<
  typeof ToolExecutionStartEvent
>;

export const ToolExecutionDeltaEvent = defineEvent("tool-execution-delta", {
  toolCallId: ToolCallId,
  chunk: JsonValue,
});
export type ToolExecutionDeltaEvent = Schema.Schema.Type<
  typeof ToolExecutionDeltaEvent
>;

export const ToolExecutionEndEvent = defineEvent("tool-execution-end", {
  toolCallId: ToolCallId,
});
export type ToolExecutionEndEvent = Schema.Schema.Type<
  typeof ToolExecutionEndEvent
>;

export const ToolResultEvent = defineEvent("tool-result", {
  toolCallId: ToolCallId,
  output: JsonValue,
  isError: Schema.Boolean,
});
export type ToolResultEvent = Schema.Schema.Type<typeof ToolResultEvent>;

export const ToolEvents = [
  ToolInputStartEvent,
  ToolInputDeltaEvent,
  ToolInputEndEvent,
  ToolCallEvent,
  ToolExecutionStartEvent,
  ToolExecutionDeltaEvent,
  ToolExecutionEndEvent,
  ToolResultEvent,
] as const;
