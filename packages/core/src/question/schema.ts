import { Effect, Schema } from "effect";

import { ToolRef } from "../toolRef";

export const QuestionID = Schema.String.check(Schema.isStartsWith("que-"));

export const Option = Schema.Struct({
  label: Schema.String.annotate({ description: "Display text" }),
  description: Schema.String.annotate({ description: "Explanation of choice" }),
});

export type Option = Schema.Schema.Type<typeof Option>;

const Prompt = Schema.Struct({
  question: Schema.String,
  header: Schema.String,
  options: Schema.Array(Option),
  multiple: Schema.optional(Schema.Boolean),
});

export const Info = Schema.Struct({
  ...Prompt.fields,
  custom: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(true))),
});

export type Info = Schema.Schema.Type<typeof Info>;

export const Request = Schema.Struct({
  id: QuestionID,
  sessionID: Schema.String,
  questions: Schema.Array(Info),
  tool: Schema.optional(ToolRef),
});

export type Request = Schema.Schema.Type<typeof Request>;

export const Answer = Schema.Array(Schema.String);

export type Answer = Schema.Schema.Type<typeof Answer>;

export const Reply = Schema.Struct({
  requestID: QuestionID,
  answers: Schema.Array(Answer),
});

export type Reply = Schema.Schema.Type<typeof Reply>;

export const QuestionAskedEvent = Schema.Struct({
  type: Schema.Literal("question.asked"),
  request: Request,
});

export type QuestionAskedEvent = Schema.Schema.Type<typeof QuestionAskedEvent>;

export const QuestionRepliedEvent = Schema.Struct({
  type: Schema.Literal("question.replied"),
  reply: Reply,
});

export type QuestionRepliedEvent = Schema.Schema.Type<
  typeof QuestionRepliedEvent
>;

const QuestionRejectedEvent = Schema.Struct({
  type: Schema.Literal("question.rejected"),
  requestID: QuestionID,
});

export const QuestionEvent = Schema.Union([
  QuestionAskedEvent,
  QuestionRepliedEvent,
  QuestionRejectedEvent,
]);

export type QuestionEvent = Schema.Schema.Type<typeof QuestionEvent>;

export class QuestionRejectedError extends Schema.TaggedErrorClass<QuestionRejectedError>()(
  "QuestionRejected",
  {},
) {}

export class QuestionRequestNotFound extends Schema.TaggedErrorClass<QuestionRequestNotFound>()(
  "QuestionRequestNotFound",
  { requestID: QuestionID },
) {}

export class QuestionInvalidReplyError extends Schema.TaggedErrorClass<QuestionInvalidReplyError>()(
  "InvalidReply",
  { requestID: QuestionID, message: Schema.String },
) {}
