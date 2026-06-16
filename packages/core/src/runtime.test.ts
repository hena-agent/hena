import { assert, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Ref, Schema, Stream } from "effect";
import { LanguageModel, Prompt, Response, Tool } from "effect/unstable/ai";

import { Runtime } from "./index";
import {
  applyAssistantPart,
  finishAssistant,
  makeAssistantState,
} from "./runtime/assistant";
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

const errorPart = (error: unknown) => ({
  type: "error" as const,
  error,
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

it.effect("records one session start across multiple prompts", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const model = yield* scriptedModel([
      [textDelta("one"), finish("stop")],
      [textDelta("two"), finish("stop")],
    ]);

    yield* runtime.registerProvider(model);
    yield* runtime.prompt(userMessage("one"));
    yield* runtime.prompt(userMessage("two"));

    const events = yield* runtime.events();

    assert.strictEqual(
      events.filter((event) => event.type === "session_start").length,
      1,
    );
  }),
);

it.effect("folds all supported assistant stream parts", () =>
  Effect.gen(function* () {
    const state = makeAssistantState();

    yield* applyAssistantPart(
      state,
      Response.makePart("text-start", { id: "t" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("text-delta", { id: "t", delta: "hello" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("text-end", { id: "t" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("text-delta", { id: "loose", delta: "!" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("text-end", { id: "missing" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("reasoning-start", { id: "r" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("reasoning-delta", { id: "r", delta: "why" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("reasoning-end", { id: "r" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("reasoning-delta", { id: "loose-r", delta: "hmm" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("reasoning-end", { id: "missing-r" }),
    );
    yield* applyAssistantPart(
      state,
      Response.toolCallPart({
        id: "call-1",
        name: "lookup",
        params: {},
        providerExecuted: false,
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.toolResultPart({
        id: "call-1",
        name: "lookup",
        isFailure: false,
        result: "ok",
        encodedResult: "ok",
        providerExecuted: false,
        preliminary: false,
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.toolResultPart({
        id: "call-2",
        name: "lookup",
        isFailure: false,
        result: "skip",
        encodedResult: "skip",
        providerExecuted: false,
        preliminary: true,
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.toolApprovalRequestPart({
        approvalId: "approval-1",
        toolCallId: "call-1",
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("file", {
        mediaType: "text/plain",
        data: new Uint8Array([1]),
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("tool-params-start", {
        id: "params-1",
        name: "lookup",
        providerExecuted: false,
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("tool-params-delta", { id: "params-1", delta: "{}" }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("tool-params-end", { id: "params-1" }),
    );
    const documentSource = yield* Schema.decodeUnknownEffect(
      Response.DocumentSourcePart,
    )({
      type: "source",
      sourceType: "document",
      id: "doc-1",
      mediaType: "text/plain",
      title: "doc",
    });

    yield* applyAssistantPart(state, documentSource);
    yield* applyAssistantPart(
      state,
      Response.makePart("response-metadata", {
        id: undefined,
        modelId: undefined,
        timestamp: undefined,
        request: undefined,
      }),
    );
    yield* applyAssistantPart(
      state,
      Response.makePart("finish", finish("stop")),
    );

    const result = finishAssistant(state);

    assert.deepStrictEqual(
      result.message.content.map((part) => part.type),
      [
        "text",
        "text",
        "reasoning",
        "reasoning",
        "tool-call",
        "tool-result",
        "tool-approval-request",
        "file",
      ],
    );
    assert.deepStrictEqual(
      result.toolCalls.map((call) => call.id),
      ["call-1"],
    );
  }),
);

it.effect("publishes message deltas before the provider stream finishes", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const deltaSeen = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const model = yield* LanguageModel.make({
      generateText: () => Effect.die("unused generateText"),
      streamText: () =>
        Stream.make(textDelta("hello")).pipe(
          Stream.concat(
            Stream.fromEffect(
              Deferred.await(release).pipe(Effect.as(finish("stop"))),
            ),
          ),
        ),
    });

    yield* runtime.registerProvider(model);
    const subscriber = yield* Stream.runForEach(runtime.subscribe(), (event) =>
      event.type === "message_delta"
        ? Deferred.succeed(deltaSeen, undefined)
        : Effect.succeed(undefined),
    ).pipe(Effect.forkChild({ startImmediately: true }));
    const promptFiber = yield* runtime
      .prompt(userMessage("hi"))
      .pipe(Effect.forkChild({ startImmediately: true }));

    yield* Deferred.await(deltaSeen);
    const eventsBeforeRelease = yield* runtime.events();

    assert.ok(
      eventsBeforeRelease.some((event) => event.type === "message_delta"),
    );
    assert.ok(
      !eventsBeforeRelease.some((event) => event.type === "message_end"),
    );

    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(promptFiber);
    yield* Fiber.interrupt(subscriber);
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

it.effect("records parallel tool results in call order", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const releaseFirst = yield* Deferred.make<void>();
    const secondStarted = yield* Deferred.make<void>();
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
          params: { text: "first" },
        },
        {
          type: "tool-call",
          id: "call-2",
          name: "echo",
          params: { text: "second" },
        },
        finish("tool-calls"),
      ],
      [textDelta("done"), finish("stop")],
    ]);

    yield* runtime.registerProvider(model);
    yield* runtime.registerTool(echo, ({ text }) => {
      if (text === "first") {
        return Deferred.await(releaseFirst).pipe(Effect.as("first"));
      }
      return Deferred.succeed(secondStarted, undefined).pipe(
        Effect.as("second"),
      );
    });
    const promptFiber = yield* runtime
      .prompt(userMessage("use echo"))
      .pipe(Effect.forkChild({ startImmediately: true }));

    yield* Deferred.await(secondStarted);
    yield* Deferred.succeed(releaseFirst, undefined);
    yield* Fiber.join(promptFiber);

    const toolMessages = (yield* runtime.history()).filter(
      (entry): entry is Prompt.ToolMessage => entry.role === "tool",
    );
    const message = toolMessages[0];

    assert.notStrictEqual(message, undefined);
    if (message === undefined) {
      return;
    }
    assert.deepStrictEqual(
      message.content.flatMap((part) =>
        part.type === "tool-result" ? [part.id] : [],
      ),
      ["call-1", "call-2"],
    );
  }),
);

it.effect("fails when no provider is registered", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const result = yield* Effect.result(runtime.prompt(userMessage("hi")));
    const history = yield* runtime.history();
    const events = yield* runtime.events();

    assert.strictEqual(result._tag, "Failure");
    assert.deepStrictEqual(history, []);
    assert.deepStrictEqual(
      events.map((event) => event.type),
      ["error", "idle"],
    );
  }),
);

it.effect("fails stream error parts and rolls back transcript", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const model = yield* scriptedModel([
      [textDelta("hello"), errorPart("boom")],
    ]);

    yield* runtime.registerProvider(model);
    const result = yield* Effect.result(runtime.prompt(userMessage("hi")));
    const history = yield* runtime.history();
    const events = yield* runtime.events();

    assert.strictEqual(result._tag, "Failure");
    assert.deepStrictEqual(history, []);
    assert.deepStrictEqual(
      events.map((event) => event.type),
      [
        "session_start",
        "turn_start",
        "message_start",
        "message_delta",
        "message_delta",
        "error",
        "idle",
      ],
    );
  }),
);

it.effect("fails runaway tool loops with a loop limit error", () =>
  Effect.gen(function* () {
    const runtime = yield* Runtime.make();
    const repeat = Tool.make("repeat", { success: Schema.String });
    const model = yield* LanguageModel.make({
      generateText: () => Effect.die("unused generateText"),
      streamText: () =>
        Stream.fromIterable([
          {
            type: "tool-call" as const,
            id: "repeat",
            name: "repeat",
            params: {},
          },
          finish("tool-calls"),
        ]),
    });

    yield* runtime.registerProvider(model);
    yield* runtime.registerTool(repeat, () => Effect.succeed("again"));
    const result = yield* Effect.result(runtime.prompt(userMessage("loop")));

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
