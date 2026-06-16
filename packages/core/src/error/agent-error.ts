import { Schema } from "effect";

import { NonNegativeIntBase, ToolCallId, ToolName } from "../domain/primitives";

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()(
  "ProviderError",
  { message: Schema.String },
) {}

export class ToolDecodeError extends Schema.TaggedErrorClass<ToolDecodeError>()(
  "ToolDecodeError",
  {
    toolCallId: ToolCallId,
    name: ToolName,
    message: Schema.String,
  },
) {}

export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  "ToolExecutionError",
  {
    toolCallId: ToolCallId,
    name: ToolName,
    message: Schema.String,
  },
) {}

export class MaxStepsExceeded extends Schema.TaggedErrorClass<MaxStepsExceeded>()(
  "MaxStepsExceeded",
  {
    maxSteps: NonNegativeIntBase,
  },
) {}

export const AgentError = Schema.Union([
  ProviderError,
  ToolDecodeError,
  ToolExecutionError,
  MaxStepsExceeded,
]).annotate({ identifier: "AgentError" });
export type AgentError = Schema.Schema.Type<typeof AgentError>;
