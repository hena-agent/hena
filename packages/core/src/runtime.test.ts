import { assert, it } from "@effect/vitest";
import { Effect, Ref, Schema, Stream } from "effect";
import { LanguageModel, Prompt, type Response, Tool } from "effect/unstable/ai";

import { Runtime } from "./index";
import { makeRegisteredTool } from "./runtime/tool";

const emptyUsage = {
  inputTokens: {
    uncached: undefined,
    total: undefined,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: undefined,
    text: undefined,
    reasoning: undefined,
  },
};

const finish = (reason: Response.FinishReason) => ({
  type: "finish" as const,
  reason,
  usage: emptyUsage,
  response: undefined,
});

const textDelta = (delta: string) => ({
  type: "text-delta" as const,
  id: "text-1",
  delta,
});

const userMessage = (value: string) =>
  Prompt.userMessage({ content: [Prompt.textPart({ text: value })] });

const scriptedModel = (
  scripts: ReadonlyArray<ReadonlyArray<Response.StreamPartEncoded>>,
) =>
  Effect.gen(function* () {
    const remaining = yield* Ref.make(scripts);

    return yield* LanguageModel.make({
      generateText: () => Effect.die("unused generateText"),
      streamText: () =>
        Stream.unwrap(
          Ref.modify(remaining, ([next, ...rest]) => [
            Stream.fromIterable(next ?? []),
            rest,
          ]),
        ),
    });
  });

it.effect("records assistant messages and lifecycle events", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const model = yield* scriptedModel([[textDelta("hello"), finish("stop")]]);

    yield* runtime.registerProvider(model);
    yield* runtime.prompt(userMessage("hi"));

    const history = yield* runtime.history();
    const events = yield* runtime.events();
    const stream = runtime.subscribe();

    assert.ok(stream);
    assert.deepStrictEqual(
      history.map((entry) => entry.role),
      ["user", "assistant"],
    );
    assert.deepStrictEqual(
      events.map((event) => event.type),
      [
        "session_start",
        "turn_start",
        "message_start",
        "message_delta",
        "message_delta",
        "message_end",
        "turn_end",
        "idle",
      ],
    );
  }),
);

it.effect("isolates failed tool handlers as failed tool results", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const fail = Tool.make("fail", { success: Schema.String });
    const model = yield* scriptedModel([
      [
        { type: "tool-call", id: "fail-1", name: "fail", params: {} },
        finish("tool-calls"),
      ],
    ]);

    yield* runtime.registerProvider(model);
    yield* runtime.registerTool(fail, () => Effect.fail("boom"));
    yield* runtime.prompt(userMessage("use fail"));

    const toolMessages = (yield* runtime.history()).filter(
      (entry): entry is Prompt.ToolMessage => entry.role === "tool",
    );
    const message = toolMessages[0];

    assert.notStrictEqual(message, undefined);
    if (message === undefined) {
      return;
    }
    const part = message.content[0];
    assert.strictEqual(part?.type, "tool-result");
    if (part?.type !== "tool-result") {
      return;
    }
    assert.strictEqual(part.result, "boom");
  }),
);

it.effect("executes requested tools and continues the loop", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const echo = Tool.make("echo", {
      parameters: Schema.Struct({ text: Schema.String }),
      success: Schema.String,
    });
    const model = yield* scriptedModel([
      [
        {
          type: "tool-call",
          id: "call-1",
          name: "echo",
          params: { text: "Hena" },
        },
        finish("tool-calls"),
      ],
      [textDelta("done"), finish("stop")],
    ]);

    yield* runtime.registerProvider(model);
    yield* runtime.registerTool(echo, ({ text }) =>
      Effect.succeed(`echo:${text}`),
    );
    yield* runtime.prompt(userMessage("use echo"));

    const history = yield* runtime.history();
    const events = yield* runtime.events();

    assert.deepStrictEqual(
      history.map((entry) => entry.role),
      ["user", "assistant", "tool", "assistant"],
    );
    assert.deepStrictEqual(
      events
        .map((event) => event.type)
        .filter((type) => type.startsWith("tool_")),
      ["tool_start", "tool_end"],
    );
  }),
);

it.effect("fails when no provider is registered", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const result = yield* Effect.result(runtime.prompt(userMessage("hi")));

    assert.strictEqual(result._tag, "Failure");
  }),
);

it.effect("validates registered tool parameters", () =>
  Effect.gen(function* () {
    const echo = Tool.make("echo", {
      parameters: Schema.Struct({ text: Schema.String }),
      success: Schema.String,
    });
    const registered = makeRegisteredTool(echo, ({ text }) =>
      Effect.succeed(text),
    );
    const result = yield* Effect.result(registered.execute({ text: 1 }));

    assert.strictEqual(result._tag, "Failure");
  }),
);
