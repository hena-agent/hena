import { Schema } from "effect";

import { JsonValue, MediaType, ToolCallId, ToolName } from "./primitives";

export const TextPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
}).annotate({ identifier: "TextPart" });
export type TextPart = Schema.Schema.Type<typeof TextPart>;

export const ReasoningPart = Schema.Struct({
  type: Schema.Literal("reasoning"),
  text: Schema.String,
}).annotate({ identifier: "ReasoningPart" });
export type ReasoningPart = Schema.Schema.Type<typeof ReasoningPart>;

export const FilePart = Schema.Struct({
  type: Schema.Literal("file"),
  mediaType: MediaType,
  data: Schema.String,
}).annotate({ identifier: "FilePart" });
export type FilePart = Schema.Schema.Type<typeof FilePart>;

export const ToolCallPart = Schema.Struct({
  type: Schema.Literal("tool-call"),
  id: ToolCallId,
  name: ToolName,
  input: JsonValue,
}).annotate({ identifier: "ToolCallPart" });
export type ToolCallPart = Schema.Schema.Type<typeof ToolCallPart>;

export const ToolResultPart = Schema.Struct({
  type: Schema.Literal("tool-result"),
  id: ToolCallId,
  name: ToolName,
  output: JsonValue,
  isError: Schema.Boolean,
}).annotate({ identifier: "ToolResultPart" });
export type ToolResultPart = Schema.Schema.Type<typeof ToolResultPart>;

export const CustomPart = Schema.Struct({
  type: Schema.TemplateLiteral(["x-", Schema.NonEmptyString]),
  data: JsonValue,
}).annotate({ identifier: "CustomPart" });
export type CustomPart = Schema.Schema.Type<typeof CustomPart>;

export const Part = Schema.Union([
  TextPart,
  ReasoningPart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  CustomPart,
]).annotate({ identifier: "Part" });
export type Part = Schema.Schema.Type<typeof Part>;
