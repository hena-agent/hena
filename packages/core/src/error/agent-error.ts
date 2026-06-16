import { Schema } from "effect";

import { NonNegativeIntBase, ToolCallId, ToolName } from "../domain/primitives";

const ToolError = Schema.Struct({
  toolCallId: ToolCallId,
  toolName: ToolName,
  message: Schema.String,
});

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()(
  "ProviderError",
  { message: Schema.String },
) {}

export class ToolDecodeError extends Schema.TaggedErrorClass<ToolDecodeError>()(
  "ToolDecodeError",
  ToolError,
) {}

export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  "ToolExecutionError",
  ToolError,
) {}

export class MaxStepsExceeded extends Schema.TaggedErrorClass<MaxStepsExceeded>()(
  "MaxStepsExceeded",
  {
    maxSteps: NonNegativeIntBase,
  },
) {}

// Tool error classes use `toolName` to avoid overwriting Error.name, while the
// public wire contract keeps the canonical tool key `name`.
export const AgentError = Schema.Union([
  Schema.TaggedStruct("ProviderError", { message: Schema.String }),
  Schema.TaggedStruct("ToolDecodeError", {
    toolCallId: ToolCallId,
    name: ToolName,
    message: Schema.String,
  }),
  Schema.TaggedStruct("ToolExecutionError", {
    toolCallId: ToolCallId,
    name: ToolName,
    message: Schema.String,
  }),
  Schema.TaggedStruct("MaxStepsExceeded", { maxSteps: NonNegativeIntBase }),
]).annotate({ identifier: "AgentError" });
export type AgentError = Schema.Schema.Type<typeof AgentError>;
