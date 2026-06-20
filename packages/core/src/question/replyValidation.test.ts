import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { validateReply } from "./replyValidation";
import type { Answer, Request } from "./schema";

const request = {
  id: "que-1",
  sessionID: "session-1",
  questions: [
    {
      question: "Pick one",
      header: "Pick",
      options: [{ label: "A", description: "First option" }],
      custom: false,
    },
  ],
} satisfies Request;

const customRequest = {
  ...request,
  questions: [
    {
      question: "Custom?",
      header: "Custom",
      options: [{ label: "A", description: "First option" }],
      custom: true,
    },
  ],
} satisfies Request;

it.effect("accepts valid replies", () =>
  Effect.gen(function* () {
    yield* validateReply(request, { requestID: request.id, answers: [["A"]] });
  }),
);

it.effect("treats sparse answer slots as empty answers", () =>
  Effect.gen(function* () {
    const answers = new Array<Answer>(1);
    yield* validateReply(customRequest, { requestID: request.id, answers });
  }),
);

it.effect("rejects invalid answer labels", () =>
  Effect.gen(function* () {
    const error = yield* validateReply(request, {
      requestID: request.id,
      answers: [["B"]],
    }).pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidReply");
    assert.strictEqual(error.requestID, request.id);
  }),
);

it.effect("rejects duplicate non-custom option labels", () =>
  Effect.gen(function* () {
    const duplicateRequest = {
      ...request,
      questions: [
        {
          question: "Pick one",
          header: "Pick",
          options: [
            { label: "A", description: "First" },
            { label: "A", description: "Second" },
          ],
          custom: false,
        },
      ],
    } satisfies Request;
    const error = yield* validateReply(duplicateRequest, {
      requestID: request.id,
      answers: [["A"]],
    }).pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidReply");
  }),
);

it.effect("rejects multiple answers for single-answer questions", () =>
  Effect.gen(function* () {
    const error = yield* validateReply(request, {
      requestID: request.id,
      answers: [["A", "B"]],
    }).pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidReply");
  }),
);

it.effect("rejects mismatched answer counts", () =>
  Effect.gen(function* () {
    const error = yield* validateReply(request, {
      requestID: request.id,
      answers: [],
    }).pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidReply");
  }),
);
