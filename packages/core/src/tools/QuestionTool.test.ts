import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer, Stream } from "effect";

import { QuestionService } from "../question/QuestionService";
import { makeQuestionAgentTool, QuestionTool } from "./QuestionTool";

const question = {
  question: "Pick one",
  header: "Pick",
  options: [{ label: "A", description: "First" }],
  custom: true,
};

it.effect("asks QuestionService with the configured session id", () => {
  const requests: Array<unknown> = [];

  return Effect.gen(function* () {
    const tool = yield* QuestionTool;
    const result = yield* tool.execute({ questions: [question] });

    assert.deepStrictEqual(requests, [
      { sessionID: "session-1", questions: [question] },
    ]);
    assert.deepStrictEqual(result.content, [{ type: "text", text: "A" }]);
    assert.deepStrictEqual(result.details, { answers: [["A"]] });
  }).pipe(
    Effect.provide(QuestionTool.layer({ sessionID: "session-1" })),
    Effect.provide(
      Layer.succeed(QuestionService)({
        ask: (input) =>
          Effect.sync(() => {
            requests.push(input);
            return [["A"]];
          }),
        events: Stream.empty,
        list: () => Effect.succeed([]),
        reject: () => Effect.void,
        reply: () => Effect.void,
      }),
    ),
  );
});

it.effect("passes tool call context to QuestionService", () => {
  const requests: Array<unknown> = [];

  return Effect.gen(function* () {
    const tool = yield* QuestionTool;
    yield* tool.execute(
      { questions: [question] },
      { toolCallId: "call-1", update: () => Effect.void },
    );

    assert.deepStrictEqual(requests, [
      {
        sessionID: "session-1",
        questions: [question],
        tool: { callID: "call-1" },
      },
    ]);
  }).pipe(
    Effect.provide(QuestionTool.layer({ sessionID: "session-1" })),
    Effect.provide(
      Layer.succeed(QuestionService)({
        ask: (input) =>
          Effect.sync(() => {
            requests.push(input);
            return [["A"]];
          }),
        events: Stream.empty,
        list: () => Effect.succeed([]),
        reject: () => Effect.void,
        reply: () => Effect.void,
      }),
    ),
  );
});

it("adapts QuestionTool to a pi AgentTool", async () => {
  const tool = makeQuestionAgentTool(
    Context.make(QuestionTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "A" }],
          details: { answers: [["A"]] },
        }),
    }),
  );

  const result = await tool.execute("call-1", { questions: [question] });

  assert.deepStrictEqual(result.details, { answers: [["A"]] });
});
