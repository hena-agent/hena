import { assert, it } from "@effect/vitest";
import { Effect, Schema, Stream } from "effect";

import type {
  JsonValue,
  ModelRequest as ModelRequestType,
  ModelStreamPart as ModelStreamPartType,
  ToolContext,
  Tool as ToolType,
} from "./index";
import {
  LanguageModel,
  ModelFinishReason,
  ModelRequest,
  ModelStreamPart,
  RunId,
  SessionId,
  ToolCallId,
  ToolChoice,
  ToolName,
  ToolResult,
  ToolSpec,
  ToolStreamChunk,
} from "./index";

type ModelStreamPartKind = ModelStreamPartType["type"];

const controller = new AbortController();

const modelRequestFixture = {
  system: "You are helpful.",
  messages: [
    {
      id: "msg_1",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
      createdAt: 1,
    },
  ],
  tools: [
    {
      name: "read",
      description: "Read a file",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  ],
  toolChoice: { tool: "read" },
  signal: controller.signal,
};

const modelStreamPartFixtures: Record<ModelStreamPartKind, unknown> = {
  "text-start": { type: "text-start", partId: "part_text" },
  "text-delta": { type: "text-delta", partId: "part_text", delta: "hello" },
  "text-end": { type: "text-end", partId: "part_text" },
  "reasoning-start": { type: "reasoning-start", partId: "part_reasoning" },
  "reasoning-delta": {
    type: "reasoning-delta",
    partId: "part_reasoning",
    delta: "thinking",
  },
  "reasoning-end": { type: "reasoning-end", partId: "part_reasoning" },
  "tool-input-start": {
    type: "tool-input-start",
    toolCallId: "call_123",
    name: "read",
  },
  "tool-input-delta": {
    type: "tool-input-delta",
    toolCallId: "call_123",
    delta: '{"path":',
  },
  "tool-input-end": { type: "tool-input-end", toolCallId: "call_123" },
  "tool-call": {
    type: "tool-call",
    toolCallId: "call_123",
    name: "read",
    input: { path: "README.md" },
  },
  usage: { type: "usage", usage: { inputTokens: 10, outputTokens: 4 } },
  finish: { type: "finish", reason: "stop" },
};

const decodeModelRequest = (): ModelRequestType =>
  Schema.decodeUnknownSync(ModelRequest)(modelRequestFixture);

it("decodes model requests", () => {
  const request = decodeModelRequest();
  const readToolName = Schema.decodeUnknownSync(ToolName)("read");

  assert.strictEqual(request.system, "You are helpful.");
  assert.strictEqual(request.messages[0]?.parts[0]?.type, "text");
  assert.strictEqual(request.tools[0]?.name, "read");
  assert.deepStrictEqual(Schema.decodeUnknownSync(ToolChoice)("auto"), "auto");
  assert.deepStrictEqual(
    Schema.decodeUnknownSync(ToolChoice)({ tool: "read" }),
    {
      tool: readToolName,
    },
  );
  assert.strictEqual(request.signal, controller.signal);
});

it("rejects malformed model requests", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(ModelRequest)({
      ...modelRequestFixture,
      signal: {},
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(ToolSpec)({
      ...modelRequestFixture.tools[0],
      name: "",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(ToolSpec)({
      ...modelRequestFixture.tools[0],
      parameters: () => "not-json",
    }),
  );

  assert.throws(() => Schema.decodeUnknownSync(ToolChoice)("manual"));
  assert.throws(() =>
    Schema.decodeUnknownSync(ModelRequest)({
      ...modelRequestFixture,
      system: undefined,
    }),
  );
});

it("decodes every model stream part", () => {
  for (const [type, part] of Object.entries(modelStreamPartFixtures)) {
    assert.strictEqual(
      Schema.decodeUnknownSync(ModelStreamPart)(part).type,
      type,
    );
  }
});

it("rejects malformed model stream parts", () => {
  assert.strictEqual(
    Schema.decodeUnknownSync(ModelFinishReason)("tool-calls"),
    "tool-calls",
  );
  assert.throws(() => Schema.decodeUnknownSync(ModelFinishReason)("retry"));

  assert.throws(() =>
    Schema.decodeUnknownSync(ModelStreamPart)({
      type: "text-delta",
      partId: "part_text",
      delta: 1,
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(ModelStreamPart)({
      type: "tool-call",
      toolCallId: "call_123",
      name: "read",
      input: undefined,
    }),
  );
});

it.effect("provides a language model service", () =>
  Effect.gen(function* () {
    const request = decodeModelRequest();
    const finishPart: ModelStreamPartType = { type: "finish", reason: "stop" };

    const parts = yield* Effect.gen(function* () {
      const model = yield* LanguageModel;
      return yield* model.stream(request).pipe(Stream.runCollect);
    }).pipe(
      Effect.provideService(LanguageModel, {
        stream: (modelRequest) => {
          assert.strictEqual(modelRequest, request);
          return Stream.fromIterable([finishPart]);
        },
      }),
    );

    assert.deepStrictEqual(parts, [finishPart]);
  }),
);

it.effect("executes a typed tool contract", () =>
  Effect.gen(function* () {
    const parameters = Schema.Struct({ path: Schema.NonEmptyString });
    type Parameters = Schema.Schema.Type<typeof parameters>;

    const emitted: Array<JsonValue> = [];
    const tool: ToolType<Parameters> = {
      name: Schema.decodeUnknownSync(ToolName)("read"),
      description: "Read a file",
      parameters,
      execute: (args, ctx) =>
        ctx
          .emit({ bytesRead: args.path.length })
          .pipe(Effect.as({ output: { path: args.path }, isError: false })),
    };
    const context: ToolContext = {
      sessionId: Schema.decodeUnknownSync(SessionId)("ses_123"),
      runId: Schema.decodeUnknownSync(RunId)("run_123"),
      toolCallId: Schema.decodeUnknownSync(ToolCallId)("call_123"),
      signal: controller.signal,
      messages: [],
      emit: (chunk) =>
        Effect.sync(() => {
          emitted.push(chunk);
        }),
    };

    const result = yield* tool.execute({ path: "README.md" }, context);

    assert.deepStrictEqual(result, {
      output: { path: "README.md" },
      isError: false,
    });
    assert.deepStrictEqual(emitted, [{ bytesRead: 9 }]);
    assert.deepStrictEqual(
      Schema.decodeUnknownSync(ToolResult)(result),
      result,
    );
    assert.deepStrictEqual(
      Schema.decodeUnknownSync(ToolStreamChunk)(emitted[0]),
      emitted[0],
    );
  }),
);
