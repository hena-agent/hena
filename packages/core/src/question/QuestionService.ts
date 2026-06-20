import { Context, Effect, Layer } from "effect";

import { makePendingRequestRegistry } from "../requestRegistry/makePendingRequestRegistry";
import type { PendingRequestFailure } from "../requestRegistry/types";
import { validateReply } from "./replyValidation";
import {
  type Answer,
  type Info,
  type QuestionEvent,
  QuestionRejectedError,
  QuestionRequestNotFound,
  type Reply,
  type Request,
} from "./schema";
import type { AskInput, QuestionServiceShape } from "./types";

const rejectQuestion = (
  request: Request,
): PendingRequestFailure<QuestionRejectedError, QuestionEvent> => ({
  failure: new QuestionRejectedError({}),
  event: { type: "question.rejected", requestID: request.id },
});

const snapshotQuestion = (question: Info): Info => ({
  question: question.question,
  header: question.header,
  options: question.options.map((option) => ({ ...option })),
  custom: question.custom,
  ...(question.multiple === undefined ? {} : { multiple: question.multiple }),
});

const makeQuestionService = Effect.fnUntraced(function* () {
  const registry = yield* makePendingRequestRegistry<
    AskInput,
    Request,
    ReadonlyArray<Answer>,
    QuestionRejectedError,
    QuestionEvent
  >({
    idPrefix: "que",
    makeRequest: (id: string, input: AskInput): Request => ({
      id,
      sessionID: input.sessionID,
      questions: input.questions.map(snapshotQuestion),
      tool: input.tool,
    }),
    askedEvent: (request: Request): QuestionEvent => ({
      type: "question.asked",
      request,
    }),
    rejectOnShutdown: rejectQuestion,
  });

  const notFound = (requestID: string): QuestionRequestNotFound =>
    new QuestionRequestNotFound({ requestID });

  const reply = Effect.fnUntraced(function* (input: Reply) {
    yield* registry.succeed(
      input.requestID,
      notFound(input.requestID),
      (request) =>
        validateReply(request, input).pipe(
          Effect.as({
            value: input.answers,
            event: { type: "question.replied", reply: input },
          }),
        ),
    );
  });

  const reject = Effect.fnUntraced(function* (requestID: string) {
    yield* registry.fail(requestID, notFound(requestID), (request) =>
      Effect.succeed(rejectQuestion(request)),
    );
  });

  return {
    ask: registry.ask,
    events: registry.events,
    list: registry.list,
    reject,
    reply,
  } satisfies QuestionServiceShape;
});

export class QuestionService extends Context.Service<
  QuestionService,
  QuestionServiceShape
>()("@hena-dev/core/QuestionService") {
  static readonly Live = Layer.effect(this)(makeQuestionService());
}
