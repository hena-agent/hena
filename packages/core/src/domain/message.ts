import { Schema } from "effect";

import { Part } from "./parts";
import {
  JsonValue,
  MessageId,
  TimestampMillis,
  TokenCount,
} from "./primitives";

// biome-ignore lint/nursery/useExplicitType: inferred schema fields avoid mirrored shape types.
const MessageFields = {
  id: MessageId,
  parts: Schema.Array(Part),
  metadata: Schema.optionalKey(Schema.Record(Schema.String, JsonValue)),
  createdAt: TimestampMillis,
};

export const Message = Schema.Struct({
  ...MessageFields,
  role: Schema.Literals(["system", "user", "assistant", "tool"]),
}).annotate({ identifier: "Message" });
export type Message = Schema.Schema.Type<typeof Message>;

export const AssistantMessage = Schema.Struct({
  ...MessageFields,
  role: Schema.Literal("assistant"),
}).annotate({ identifier: "AssistantMessage" });
export type AssistantMessage = Schema.Schema.Type<typeof AssistantMessage>;

export const Usage = Schema.Struct({
  inputTokens: Schema.optionalKey(TokenCount),
  outputTokens: Schema.optionalKey(TokenCount),
  reasoningTokens: Schema.optionalKey(TokenCount),
  cacheReadTokens: Schema.optionalKey(TokenCount),
  cacheWriteTokens: Schema.optionalKey(TokenCount),
}).annotate({ identifier: "Usage" });
export type Usage = Schema.Schema.Type<typeof Usage>;
