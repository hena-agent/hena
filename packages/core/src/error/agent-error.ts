import { Schema } from "effect";

import { NonNegativeIntBase, ToolCallId, ToolName } from "../domain/primitives";

// Tool errors are not nested in a tool-call part, so their payload uses
// self-describing keys. `toolName` also preserves Error.name as the error tag.
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

export const AgentError = Schema.Union([
  ProviderError,
  ToolDecodeError,
  ToolExecutionError,
  MaxStepsExceeded,
]).annotate({ identifier: "AgentError" });
export type AgentError = Schema.Schema.Type<typeof AgentError>;
