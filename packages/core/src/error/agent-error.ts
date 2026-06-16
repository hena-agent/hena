import { Schema } from "effect";

import { ToolCallId, ToolName } from "../domain/primitives";

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const MessageField: {
  readonly message: typeof Schema.String;
} = {
  message: Schema.String,
};
const ToolErrorFields: {
  readonly toolCallId: typeof ToolCallId;
  readonly name: typeof ToolName;
  readonly message: typeof Schema.String;
} = {
  toolCallId: ToolCallId,
  name: ToolName,
  ...MessageField,
};

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()(
  "ProviderError",
  MessageField,
) {}

export class ToolDecodeError extends Schema.TaggedErrorClass<ToolDecodeError>()(
  "ToolDecodeError",
  ToolErrorFields,
) {}

export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  "ToolExecutionError",
  ToolErrorFields,
) {}

export class MaxStepsExceeded extends Schema.TaggedErrorClass<MaxStepsExceeded>()(
  "MaxStepsExceeded",
  {
    maxSteps: NonNegativeInt,
  },
) {}

export const AgentError = Schema.Union([
  ProviderError,
  ToolDecodeError,
  ToolExecutionError,
  MaxStepsExceeded,
]).annotate({ identifier: "AgentError" });
export type AgentError = Schema.Schema.Type<typeof AgentError>;
