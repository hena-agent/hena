import { Schema } from "effect";

const Branded = <Base extends Schema.Top, const Name extends string>(
  base: Base,
  name: Name,
): Schema.brand<Base["Rebuild"], Name> =>
  base.pipe(Schema.brand(name)).annotate({ identifier: name });

const NonNegativeIntBase = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const JsonValue = Schema.Json.annotate({ identifier: "JsonValue" });
export type JsonValue = Schema.Schema.Type<typeof JsonValue>;
export const TimestampMillis = Branded(NonNegativeIntBase, "TimestampMillis");
export type TimestampMillis = Schema.Schema.Type<typeof TimestampMillis>;
export const TokenCount = Branded(NonNegativeIntBase, "TokenCount");
export type TokenCount = Schema.Schema.Type<typeof TokenCount>;
export const SessionId = Branded(Schema.NonEmptyString, "SessionId");
export type SessionId = Schema.Schema.Type<typeof SessionId>;
export const RunId = Branded(Schema.NonEmptyString, "RunId");
export type RunId = Schema.Schema.Type<typeof RunId>;

export const MessageId = Branded(Schema.NonEmptyString, "MessageId");
export type MessageId = Schema.Schema.Type<typeof MessageId>;

export const ToolCallId = Branded(Schema.NonEmptyString, "ToolCallId");
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
  input: JsonValue,
}).annotate({ identifier: "ToolCallPart" });
export type ToolCallPart = Schema.Schema.Type<typeof ToolCallPart>;

export const ToolResultPart = Schema.Struct({
  type: Schema.Literal("tool-result"),
  id: ToolCallId,
  name: Schema.String,
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

export const Message = Schema.Struct({
  id: MessageId,
  role: Schema.Literals(["system", "user", "assistant", "tool"]),
  parts: Schema.Array(Part),
  metadata: Schema.optional(Schema.Record(Schema.String, JsonValue)),
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
