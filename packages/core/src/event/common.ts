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

// biome-ignore lint/nursery/useExplicitType: explicit mirror types create drift here.
const EventBaseFields = {
  runId: RunId,
  sessionId: SessionId,
  seq: EventSeq,
};

// biome-ignore lint/nursery/useExplicitType: explicit mirror types create drift here.
const TextStreamFields = {
  messageId: MessageId,
  partId: PartId,
};

type ReservedEventField = keyof typeof EventBaseFields | "type";

type EventFieldsInput<Fields extends Schema.Struct.Fields> =
  Extract<keyof Fields, ReservedEventField> extends never ? Fields : never;

// biome-ignore lint/nursery/useExplicitType: preserve Effect Schema service inference.
export const defineEvent = <
  const Type extends string,
  const Fields extends Schema.Struct.Fields,
>(
  type: Type,
  fields: EventFieldsInput<Fields>,
) =>
  Schema.Struct({
    ...fields,
    ...EventBaseFields,
    type: Schema.Literal(type),
  }).annotate({ identifier: eventIdentifier(type) });

// biome-ignore lint/nursery/useExplicitType: preserve Effect Schema service inference.
export const defineTextStreamEvent = <
  const Type extends string,
  const Fields extends Schema.Struct.Fields,
>(
  type: Type,
  fields: EventFieldsInput<Fields>,
) =>
  Schema.Struct({
    ...fields,
    ...TextStreamFields,
    ...EventBaseFields,
    type: Schema.Literal(type),
  }).annotate({ identifier: eventIdentifier(type) });
