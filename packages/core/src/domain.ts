import { Schema } from "effect";

const BrandedId = <const Name extends string>(
  name: Name,
): Schema.brand<typeof Schema.String, Name> =>
  Schema.String.pipe(Schema.brand(name)).annotate({ identifier: name });

export const TimestampMillis = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
).annotate({ identifier: "TimestampMillis" });
export type TimestampMillis = Schema.Schema.Type<typeof TimestampMillis>;

export const TokenCount = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
).annotate({ identifier: "TokenCount" });
export type TokenCount = Schema.Schema.Type<typeof TokenCount>;

export const SessionId = BrandedId("SessionId");
export type SessionId = Schema.Schema.Type<typeof SessionId>;

export const RunId = BrandedId("RunId");
export type RunId = Schema.Schema.Type<typeof RunId>;

export const MessageId = BrandedId("MessageId");
export type MessageId = Schema.Schema.Type<typeof MessageId>;

export const ToolCallId = BrandedId("ToolCallId");
export type ToolCallId = Schema.Schema.Type<typeof ToolCallId>;

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
  mediaType: Schema.String,
  data: Schema.String,
}).annotate({ identifier: "FilePart" });
export type FilePart = Schema.Schema.Type<typeof FilePart>;

export const ToolCallPart = Schema.Struct({
  type: Schema.Literal("tool-call"),
  id: ToolCallId,
  name: Schema.String,
  input: Schema.Unknown,
}).annotate({ identifier: "ToolCallPart" });
export type ToolCallPart = Schema.Schema.Type<typeof ToolCallPart>;

export const ToolResultPart = Schema.Struct({
  type: Schema.Literal("tool-result"),
  id: ToolCallId,
  name: Schema.String,
  output: Schema.Unknown,
  isError: Schema.Boolean,
}).annotate({ identifier: "ToolResultPart" });
export type ToolResultPart = Schema.Schema.Type<typeof ToolResultPart>;

export const CustomPart = Schema.Struct({
  type: Schema.String.check(Schema.isStartsWith("x-")),
  data: Schema.Unknown,
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

export const Message = Schema.Struct({
  id: MessageId,
  role: Schema.Literals(["system", "user", "assistant", "tool"]),
  parts: Schema.Array(Part),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: TimestampMillis,
}).annotate({ identifier: "Message" });
export type Message = Schema.Schema.Type<typeof Message>;

export const Usage = Schema.Struct({
  inputTokens: Schema.optional(TokenCount),
  outputTokens: Schema.optional(TokenCount),
  reasoningTokens: Schema.optional(TokenCount),
  cacheReadTokens: Schema.optional(TokenCount),
  cacheWriteTokens: Schema.optional(TokenCount),
}).annotate({ identifier: "Usage" });
export type Usage = Schema.Schema.Type<typeof Usage>;
