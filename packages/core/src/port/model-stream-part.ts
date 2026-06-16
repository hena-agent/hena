import { Schema } from "effect";

import { Usage } from "../domain/message";
import { JsonValue, PartId, ToolCallId, ToolName } from "../domain/primitives";

export const ModelFinishReason = Schema.Literals([
  "stop",
  "length",
  "content-filter",
  "tool-calls",
  "error",
  "pause",
  "other",
  "unknown",
]).annotate({ identifier: "ModelFinishReason" });
export type ModelFinishReason = Schema.Schema.Type<typeof ModelFinishReason>;

const TextStartStreamPart = Schema.Struct({
  type: Schema.Literal("text-start"),
  partId: PartId,
});
const TextDeltaStreamPart = Schema.Struct({
  type: Schema.Literal("text-delta"),
  partId: PartId,
  delta: Schema.String,
});
const TextEndStreamPart = Schema.Struct({
  type: Schema.Literal("text-end"),
  partId: PartId,
});
const ReasoningStartStreamPart = Schema.Struct({
  type: Schema.Literal("reasoning-start"),
  partId: PartId,
});
const ReasoningDeltaStreamPart = Schema.Struct({
  type: Schema.Literal("reasoning-delta"),
  partId: PartId,
  delta: Schema.String,
});
const ReasoningEndStreamPart = Schema.Struct({
  type: Schema.Literal("reasoning-end"),
  partId: PartId,
});
const ToolInputStartStreamPart = Schema.Struct({
  type: Schema.Literal("tool-input-start"),
  toolCallId: ToolCallId,
  name: ToolName,
});
const ToolInputDeltaStreamPart = Schema.Struct({
  type: Schema.Literal("tool-input-delta"),
  toolCallId: ToolCallId,
  delta: Schema.String,
});
const ToolInputEndStreamPart = Schema.Struct({
  type: Schema.Literal("tool-input-end"),
  toolCallId: ToolCallId,
});
const ToolCallStreamPart = Schema.Struct({
  type: Schema.Literal("tool-call"),
  toolCallId: ToolCallId,
  name: ToolName,
  input: JsonValue,
});
const UsageStreamPart = Schema.Struct({
  type: Schema.Literal("usage"),
  usage: Usage,
});
const FinishStreamPart = Schema.Struct({
  type: Schema.Literal("finish"),
  reason: ModelFinishReason,
});

export const ModelStreamPart = Schema.Union([
  TextStartStreamPart,
  TextDeltaStreamPart,
  TextEndStreamPart,
  ReasoningStartStreamPart,
  ReasoningDeltaStreamPart,
  ReasoningEndStreamPart,
  ToolInputStartStreamPart,
  ToolInputDeltaStreamPart,
  ToolInputEndStreamPart,
  ToolCallStreamPart,
  UsageStreamPart,
  FinishStreamPart,
]).annotate({ identifier: "ModelStreamPart" });
export type ModelStreamPart = Schema.Schema.Type<typeof ModelStreamPart>;
