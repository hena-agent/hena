import { assert, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

import type { Answer, Info } from "./schema";
import type { AskInput, QuestionServiceShape } from "./types";

const question = {
  question: "Continue?",
  header: "Continue",
  options: [{ label: "Yes", description: "Continue the run" }],
  custom: true,
} satisfies Info;

const input = {
  sessionID: "session-1",
  questions: [question],
} satisfies AskInput;

it("models question service input types", () => {
  assert.strictEqual(input.sessionID, "session-1");
  assert.strictEqual(input.questions[0]?.header, "Continue");
});

it.effect("models question service shape types", () =>
  Effect.gen(function* () {
    const answers: ReadonlyArray<Answer> = [["Yes"]];
    const service: QuestionServiceShape = {
      ask: () => Effect.succeed(answers),
      events: Stream.empty,
      list: () => Effect.succeed([]),
      reject: () => Effect.succeed(void 0),
      reply: () => Effect.succeed(void 0),
    };

    assert.deepStrictEqual(yield* service.ask(input), answers);
  }),
);
