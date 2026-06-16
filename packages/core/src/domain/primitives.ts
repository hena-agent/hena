import { Schema } from "effect";

const Branded = <Base extends Schema.Top, const Name extends string>(
  base: Base,
  name: Name,
): Schema.brand<Base["Rebuild"], Name> =>
  base.pipe(Schema.brand(name)).annotate({ identifier: name });

export const NonNegativeIntBase = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(0),
);
const isMediaType = Schema.isPattern(/^[^/\s]+\/[^/\s]+$/);

export const JsonValue = Schema.Json.annotate({ identifier: "JsonValue" });
export type JsonValue = Schema.Schema.Type<typeof JsonValue>;

export const TimestampMillis = Branded(NonNegativeIntBase, "TimestampMillis");
export type TimestampMillis = Schema.Schema.Type<typeof TimestampMillis>;

export const TokenCount = Branded(NonNegativeIntBase, "TokenCount");
export type TokenCount = Schema.Schema.Type<typeof TokenCount>;

export const EventSeq = Branded(NonNegativeIntBase, "EventSeq");
export type EventSeq = Schema.Schema.Type<typeof EventSeq>;

export const MediaType = Branded(Schema.String.check(isMediaType), "MediaType");
export type MediaType = Schema.Schema.Type<typeof MediaType>;

export const SessionId = Branded(Schema.NonEmptyString, "SessionId");
export type SessionId = Schema.Schema.Type<typeof SessionId>;

export const RunId = Branded(Schema.NonEmptyString, "RunId");
export type RunId = Schema.Schema.Type<typeof RunId>;

export const MessageId = Branded(Schema.NonEmptyString, "MessageId");
export type MessageId = Schema.Schema.Type<typeof MessageId>;

export const PartId = Branded(Schema.NonEmptyString, "PartId");
export type PartId = Schema.Schema.Type<typeof PartId>;

export const ToolCallId = Branded(Schema.NonEmptyString, "ToolCallId");
export type ToolCallId = Schema.Schema.Type<typeof ToolCallId>;

export const ToolName = Branded(Schema.NonEmptyString, "ToolName");
export type ToolName = Schema.Schema.Type<typeof ToolName>;
