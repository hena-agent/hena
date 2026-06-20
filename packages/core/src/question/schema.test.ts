import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  Info,
  Option,
  QuestionAskedEvent,
  QuestionInvalidReplyError,
  QuestionRejectedError,
  QuestionRepliedEvent,
  QuestionRequestNotFound,
  Reply,
  Request,
} from "./schema";

it("decodes question request shapes", () => {
  const request = Schema.decodeUnknownSync(Request)({
    id: "que-1",
    sessionID: "session-1",
    questions: [
      {
        question: "Continue?",
        header: "Continue",
        options: [{ label: "Yes", description: "Continue the run" }],
        custom: true,
      },
    ],
    tool: { callID: "call-1" },
  });

  assert.strictEqual(request.id, "que-1");
  assert.strictEqual(request.questions[0]?.custom, true);
});

it("decodes replies and prompt variants", () => {
  const option = Schema.decodeUnknownSync(Option)({
    label: "Stop",
    description: "Stop the run",
  });
  const info = Schema.decodeUnknownSync(Info)({
    question: "Stop?",
    header: "Stop",
    options: [option],
    multiple: false,
  });
  const reply = Schema.decodeUnknownSync(Reply)({
    requestID: "que-1",
    answers: [["Stop"]],
  });

  assert.strictEqual(info.options[0]?.label, "Stop");
  assert.strictEqual(info.custom, true);
  assert.deepStrictEqual(reply.answers, [["Stop"]]);
});

it("decodes question event DTOs", () => {
  const request = Schema.decodeUnknownSync(Request)({
    id: "que-1",
    sessionID: "session-1",
    questions: [
      {
        question: "Continue?",
        header: "Continue",
        options: [{ label: "Yes", description: "Continue the run" }],
      },
    ],
  });
  const asked = Schema.decodeUnknownSync(QuestionAskedEvent)({
    type: "question.asked",
    request,
  });
  const replied = Schema.decodeUnknownSync(QuestionRepliedEvent)({
    type: "question.replied",
    reply: { requestID: request.id, answers: [["Yes"]] },
  });

  assert.strictEqual(asked.request.questions[0]?.custom, true);
  assert.strictEqual(replied.reply.requestID, "que-1");
});

it("models question service errors", () => {
  const rejected = new QuestionRejectedError({});
  const missing = new QuestionRequestNotFound({ requestID: "que-missing" });
  const invalid = new QuestionInvalidReplyError({
    requestID: "que-missing",
    message: "invalid",
  });

  assert.strictEqual(rejected._tag, "QuestionRejected");
  assert.strictEqual(missing._tag, "QuestionRequestNotFound");
  assert.strictEqual(missing.requestID, "que-missing");
  assert.strictEqual(invalid._tag, "InvalidReply");
});
