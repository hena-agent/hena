import { Schema } from "effect";

import { Message } from "../domain/message";
import { MessageId } from "../domain/primitives";
import { defineEvent, defineTextStreamEvent } from "./common";

export const MessageStartEvent = defineEvent("message-start", {
  messageId: MessageId,
  role: Schema.Literal("assistant"),
});
export type MessageStartEvent = Schema.Schema.Type<typeof MessageStartEvent>;

export const MessageEndEvent = defineEvent("message-end", {
  message: Message,
});
export type MessageEndEvent = Schema.Schema.Type<typeof MessageEndEvent>;

export const TextStartEvent = defineTextStreamEvent("text-start", {});
export type TextStartEvent = Schema.Schema.Type<typeof TextStartEvent>;

export const TextDeltaEvent = defineTextStreamEvent("text-delta", {
  delta: Schema.String,
});
export type TextDeltaEvent = Schema.Schema.Type<typeof TextDeltaEvent>;

export const TextEndEvent = defineTextStreamEvent("text-end", {});
export type TextEndEvent = Schema.Schema.Type<typeof TextEndEvent>;

export const ReasoningStartEvent = defineTextStreamEvent("reasoning-start", {});
export type ReasoningStartEvent = Schema.Schema.Type<
  typeof ReasoningStartEvent
>;

export const ReasoningDeltaEvent = defineTextStreamEvent("reasoning-delta", {
  delta: Schema.String,
});
export type ReasoningDeltaEvent = Schema.Schema.Type<
  typeof ReasoningDeltaEvent
>;

export const ReasoningEndEvent = defineTextStreamEvent("reasoning-end", {});
export type ReasoningEndEvent = Schema.Schema.Type<typeof ReasoningEndEvent>;

export const MessageEvents = [
  MessageStartEvent,
  MessageEndEvent,
  TextStartEvent,
  TextDeltaEvent,
  TextEndEvent,
  ReasoningStartEvent,
  ReasoningDeltaEvent,
  ReasoningEndEvent,
] as const;
