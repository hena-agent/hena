import { Schema } from "effect";

import { Message } from "../domain/message";
import { MessageId } from "../domain/primitives";
import { EventBaseFields, TextStreamFields } from "./common";

export const MessageStartEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("message-start"),
  messageId: MessageId,
  role: Schema.Literal("assistant"),
}).annotate({ identifier: "MessageStartEvent" });
export type MessageStartEvent = Schema.Schema.Type<typeof MessageStartEvent>;

export const MessageEndEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("message-end"),
  message: Message,
}).annotate({ identifier: "MessageEndEvent" });
export type MessageEndEvent = Schema.Schema.Type<typeof MessageEndEvent>;

export const TextStartEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("text-start"),
}).annotate({ identifier: "TextStartEvent" });
export type TextStartEvent = Schema.Schema.Type<typeof TextStartEvent>;

export const TextDeltaEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("text-delta"),
  delta: Schema.String,
}).annotate({ identifier: "TextDeltaEvent" });
export type TextDeltaEvent = Schema.Schema.Type<typeof TextDeltaEvent>;

export const TextEndEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("text-end"),
}).annotate({ identifier: "TextEndEvent" });
export type TextEndEvent = Schema.Schema.Type<typeof TextEndEvent>;

export const ReasoningStartEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("reasoning-start"),
}).annotate({ identifier: "ReasoningStartEvent" });
export type ReasoningStartEvent = Schema.Schema.Type<
  typeof ReasoningStartEvent
>;

export const ReasoningDeltaEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("reasoning-delta"),
  delta: Schema.String,
}).annotate({ identifier: "ReasoningDeltaEvent" });
export type ReasoningDeltaEvent = Schema.Schema.Type<
  typeof ReasoningDeltaEvent
>;

export const ReasoningEndEvent = Schema.Struct({
  ...TextStreamFields,
  type: Schema.Literal("reasoning-end"),
}).annotate({ identifier: "ReasoningEndEvent" });
export type ReasoningEndEvent = Schema.Schema.Type<typeof ReasoningEndEvent>;
