import { Schema } from "effect";

import {
  EventSeq,
  MessageId,
  PartId,
  RunId,
  SessionId,
} from "../domain/primitives";

const eventIdentifier = (type: string): string =>
  `${type
    .split("-")
    .map((segment) => `${segment[0]?.toUpperCase()}${segment.slice(1)}`)
    .join("")}Event`;

const structFields = <const Fields extends Schema.Struct.Fields>(
  fields: Fields,
): Fields => fields;

export const EventBaseFields = structFields({
  runId: RunId,
  sessionId: SessionId,
  seq: EventSeq,
});

export const TextStreamFields = structFields({
  ...EventBaseFields,
  messageId: MessageId,
  partId: PartId,
});

type EventFields<
  Type extends string,
  Fields extends Schema.Struct.Fields,
> = typeof EventBaseFields &
  Fields & {
    readonly type: Schema.Literal<Type>;
  };

export const defineEvent = <
  const Type extends string,
  const Fields extends Schema.Struct.Fields,
>(
  type: Type,
  fields: Fields,
): Schema.Struct<EventFields<Type, Fields>> =>
  Schema.Struct({
    ...EventBaseFields,
    type: Schema.Literal(type),
    ...fields,
  }).annotate({ identifier: eventIdentifier(type) });

export const defineTextStreamEvent = <
  const Type extends string,
  const Fields extends Schema.Struct.Fields,
>(
  type: Type,
  fields: Fields,
): Schema.Struct<EventFields<Type, typeof TextStreamFields & Fields>> =>
  defineEvent(type, structFields({ ...TextStreamFields, ...fields }));
