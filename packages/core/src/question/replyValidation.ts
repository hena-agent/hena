import { Effect } from "effect";
import type { Answer, Info, Reply, Request } from "./schema";
import { QuestionInvalidReplyError } from "./schema";

const invalidReply = (
  requestID: string,
  message: string,
): QuestionInvalidReplyError =>
  new QuestionInvalidReplyError({ requestID, message });

const validateAnswer = (
  requestID: string,
  question: Info,
  answer: Answer,
): Effect.Effect<void, QuestionInvalidReplyError> => {
  if (!question.multiple && answer.length > 1) {
    return Effect.fail(
      invalidReply(requestID, "Question does not allow multiple answers"),
    );
  }

  if (question.custom) {
    return Effect.void;
  }

  const labels = new Set(question.options.map((option) => option.label));
  const invalid = answer.find((value) => !labels.has(value));
  if (invalid !== undefined) {
    return Effect.fail(
      invalidReply(
        requestID,
        `Answer ${JSON.stringify(invalid)} is not one of the prompt options`,
      ),
    );
  }

  return Effect.void;
};

export const validateReply = (
  request: Request,
  reply: Reply,
): Effect.Effect<void, QuestionInvalidReplyError> => {
  if (reply.answers.length !== request.questions.length) {
    return Effect.fail(
      invalidReply(
        reply.requestID,
        "Reply answer count must match question count",
      ),
    );
  }

  return Effect.forEach(
    request.questions,
    (question, index) => {
      const answer = reply.answers[index] ?? [];
      return validateAnswer(reply.requestID, question, answer);
    },
    { discard: true },
  );
};
