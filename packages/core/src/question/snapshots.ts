import type { Info, Reply, Request } from "./schema";

export const snapshotQuestion = (question: Info): Info => ({
  question: question.question,
  header: question.header,
  options: question.options.map((option) => ({ ...option })),
  custom: question.custom,
  ...(question.multiple === undefined ? {} : { multiple: question.multiple }),
});

export const snapshotRequest = (request: Request): Request => ({
  id: request.id,
  sessionID: request.sessionID,
  questions: request.questions.map(snapshotQuestion),
  ...(request.tool === undefined ? {} : { tool: request.tool }),
});

export const snapshotReply = (reply: Reply): Reply => ({
  requestID: reply.requestID,
  answers: reply.answers.map((answer) => [...answer]),
});
