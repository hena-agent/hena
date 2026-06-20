import type { Effect, Stream } from "effect";

import type {
  Answer,
  Info,
  QuestionEvent,
  QuestionInvalidReplyError,
  QuestionRejectedError,
  QuestionRequestNotFound,
  Reply,
  Request,
  Tool,
} from "./schema";

export interface AskInput {
  readonly sessionID: string;
  readonly questions: ReadonlyArray<Info>;
  readonly tool?: Tool;
}

export interface QuestionServiceShape {
  readonly ask: (
    input: AskInput,
  ) => Effect.Effect<ReadonlyArray<Answer>, QuestionRejectedError>;
  readonly events: Stream.Stream<QuestionEvent>;
  readonly list: () => Effect.Effect<ReadonlyArray<Request>>;
  readonly reject: (
    requestID: string,
  ) => Effect.Effect<void, QuestionRequestNotFound>;
  readonly reply: (
    input: Reply,
  ) => Effect.Effect<void, QuestionInvalidReplyError | QuestionRequestNotFound>;
}
