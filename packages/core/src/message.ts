import { Schema } from "effect";

import { Part } from "./parts";
import {
  JsonValue,
  MessageId,
  TimestampMillis,
  TokenCount,
} from "./primitives";

export const Message = Schema.Struct({
  id: MessageId,
  role: Schema.Literals(["system", "user", "assistant", "tool"]),
  parts: Schema.Array(Part),
  metadata: Schema.optionalKey(Schema.Record(Schema.String, JsonValue)),
  createdAt: TimestampMillis,
}).annotate({ identifier: "Message" });
export type Message = Schema.Schema.Type<typeof Message>;

export const Usage = Schema.Struct({
  inputTokens: Schema.optionalKey(TokenCount),
  outputTokens: Schema.optionalKey(TokenCount),
  reasoningTokens: Schema.optionalKey(TokenCount),
  cacheReadTokens: Schema.optionalKey(TokenCount),
  cacheWriteTokens: Schema.optionalKey(TokenCount),
}).annotate({ identifier: "Usage" });
export type Usage = Schema.Schema.Type<typeof Usage>;
