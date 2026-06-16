import {
  EventSeq,
  MessageId,
  PartId,
  RunId,
  SessionId,
} from "../domain/primitives";

type EventBaseFields = {
  readonly runId: typeof RunId;
  readonly sessionId: typeof SessionId;
  readonly seq: typeof EventSeq;
};

type TextStreamFields = EventBaseFields & {
  readonly messageId: typeof MessageId;
  readonly partId: typeof PartId;
};

export const EventBaseFields: EventBaseFields = {
  runId: RunId,
  sessionId: SessionId,
  seq: EventSeq,
};

export const TextStreamFields: TextStreamFields = {
  ...EventBaseFields,
  messageId: MessageId,
  partId: PartId,
};
