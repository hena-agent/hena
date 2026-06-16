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

type ReservedEventField<Owned extends Schema.Struct.Fields> =
  | keyof typeof EventBaseFields
  | keyof Owned
  | "type";

type EventFieldsInput<
  Owned extends Schema.Struct.Fields,
  Fields extends Schema.Struct.Fields,
> =
  Extract<keyof Fields, ReservedEventField<Owned>> extends never
    ? Fields
    : never;

const makeEventFactory =
  <const Owned extends Schema.Struct.Fields>(owned: Owned) =>
  // biome-ignore lint/nursery/useExplicitType: preserve Effect Schema service inference.
  <const Type extends string, const Fields extends Schema.Struct.Fields>(
    type: Type,
    fields: EventFieldsInput<Owned, Fields>,
  ) =>
    Schema.Struct({
      ...fields,
      ...owned,
      ...EventBaseFields,
      type: Schema.Literal(type),
    }).annotate({ identifier: eventIdentifier(type) });

export const defineEvent = makeEventFactory({});
export const defineTextStreamEvent = makeEventFactory(TextStreamFields);
