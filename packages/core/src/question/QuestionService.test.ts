import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";

import { QuestionService } from "./QuestionService";

it.effect("resolves pending question requests by request id", () =>
  Effect.gen(function* () {
    const service = yield* QuestionService;
    const eventsFiber = yield* service.events.pipe(
      Stream.take(2),
      Stream.runCollect,
      Effect.forkDetach({ startImmediately: true }),
    );
    const fiber = yield* service
      .ask({
        sessionID: "session-1",
        questions: [
          {
            question: "Continue?",
            header: "Continue",
            options: [{ label: "Yes", description: "Continue the run" }],
            custom: true,
          },
        ],
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const pending = yield* service.list();

    assert.strictEqual(pending.length, 1);
    assert.ok(pending[0]?.id.startsWith("que"));

    const request = pending[0];
    if (request === undefined) {
      throw new Error("expected a pending question request");
    }

    yield* service.reply({ requestID: request.id, answers: [["Yes"]] });
    const answers = yield* Fiber.join(fiber);
    const events = yield* Fiber.join(eventsFiber);

    assert.deepStrictEqual(answers, [["Yes"]]);
    assert.deepStrictEqual(yield* service.list(), []);
    assert.deepStrictEqual(
      events.map((event) => event.type),
      ["question.asked", "question.replied"],
    );
  }).pipe(Effect.provide(QuestionService.Live)),
);

it.effect("rejects questions and reports missing request ids", () =>
  Effect.gen(function* () {
    const service = yield* QuestionService;
    const fiber = yield* service
      .ask({
        sessionID: "session-1",
        questions: [
          {
            question: "Stop?",
            header: "Stop",
            options: [{ label: "Stop", description: "Reject the request" }],
            custom: true,
          },
        ],
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [pending] = yield* service.list();
    if (pending === undefined) {
      throw new Error("expected a pending question request");
    }

    yield* service.reject(pending.id);
    const exit = yield* Fiber.join(fiber).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
    const replyError = yield* service
      .reply({ requestID: "que-missing", answers: [] })
      .pipe(Effect.flip);
    assert.strictEqual(replyError._tag, "QuestionRequestNotFound");
    assert.strictEqual(replyError.requestID, "que-missing");

    const rejectError = yield* service.reject("que-missing").pipe(Effect.flip);
    assert.strictEqual(rejectError._tag, "QuestionRequestNotFound");
    assert.strictEqual(rejectError.requestID, "que-missing");
  }).pipe(Effect.provide(QuestionService.Live)),
);

it.effect("rejects invalid replies without resolving the pending request", () =>
  Effect.gen(function* () {
    const service = yield* QuestionService;
    const fiber = yield* service
      .ask({
        sessionID: "session-1",
        questions: [
          {
            question: "Pick one",
            header: "Pick",
            options: [{ label: "A", description: "First option" }],
            custom: false,
          },
        ],
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;
    const [pending] = yield* service.list();
    if (pending === undefined) {
      throw new Error("expected a pending question request");
    }

    const error = yield* service
      .reply({ requestID: pending.id, answers: [["B"]] })
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidReply");
    assert.deepStrictEqual(yield* service.list(), [pending]);

    yield* service.reject(pending.id);
    yield* Fiber.join(fiber).pipe(Effect.exit);
  }).pipe(Effect.provide(QuestionService.Live)),
);

it.effect("rejects pending questions when the service scope closes", () =>
  Effect.gen(function* () {
    const exit = yield* Effect.scoped(
      Effect.gen(function* () {
        const service = yield* QuestionService;
        const fiber = yield* service
          .ask({
            sessionID: "session-1",
            questions: [
              {
                question: "Wait?",
                header: "Wait",
                options: [{ label: "Wait", description: "Wait forever" }],
                custom: true,
              },
            ],
          })
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Effect.yieldNow;
        return fiber;
      }).pipe(Effect.provide(QuestionService.Live)),
    ).pipe(
      Effect.flatMap((fiber) => Fiber.join(fiber)),
      Effect.exit,
    );

    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("snapshots question request inputs", () =>
  Effect.gen(function* () {
    const service = yield* QuestionService;
    const option = { label: "Yes", description: "Continue" };
    const options = [option];
    const question = {
      question: "Continue?",
      header: "Continue",
      options,
      custom: true,
      multiple: false,
    };
    const questions = [question];
    const fiber = yield* service
      .ask({ sessionID: "session-1", questions })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    question.question = "Mutated?";
    option.label = "No";
    options.push({ label: "Maybe", description: "Mutated" });
    yield* Effect.yieldNow;
    const [pending] = yield* service.list();
    if (pending === undefined) {
      throw new Error("expected a pending question request");
    }

    assert.deepStrictEqual(pending.questions, [
      {
        question: "Continue?",
        header: "Continue",
        options: [{ label: "Yes", description: "Continue" }],
        custom: true,
        multiple: false,
      },
    ]);

    yield* service.reject(pending.id);
    yield* Fiber.join(fiber).pipe(Effect.exit);
  }).pipe(Effect.provide(QuestionService.Live)),
);
