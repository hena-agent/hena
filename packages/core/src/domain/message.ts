import { Schema } from "effect";

import { MessageId } from "./id";
import { Part } from "./part";

/** The author role of a {@link Message}. */
export const MessageRole = Schema.Literals([
  "system",
  "user",
  "assistant",
  "tool",
]);
export type MessageRole = typeof MessageRole.Type;

/**
 * A single entry in a transcript. The core holds messages only as values
 * threaded through a run; persistence is an extension that subscribes to the
 * event stream. `createdAt` is epoch milliseconds sourced from the injected
 * `Clock`.
 */
export const Message = Schema.Struct({
  id: MessageId,
  role: MessageRole,
  parts: Schema.Array(Part),
  metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  createdAt: Schema.Number,
});

export type Message = typeof Message.Type;
