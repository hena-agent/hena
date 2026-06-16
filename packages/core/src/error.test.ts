import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  AgentError,
  MaxStepsExceeded,
  ProviderError,
  ToolCallId,
  ToolDecodeError,
  ToolExecutionError,
  ToolName,
} from "./index";

const toolCallId = Schema.decodeUnknownSync(ToolCallId)("call_123");
const toolName = Schema.decodeUnknownSync(ToolName)("read");

it("constructs tagged provider errors", () => {
  const error = new ProviderError({ message: "provider unavailable" });

  assert.strictEqual(error._tag, "ProviderError");
  assert.strictEqual(error.message, "provider unavailable");
});

it.effect("yields provider errors from Effect workflows", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(
      Effect.gen(function* () {
        return yield* new ProviderError({ message: "model failed" });
      }),
    );

    assert.instanceOf(failure, ProviderError);
  }),
);

it("decodes every core agent error", () => {
  for (const input of [
    { _tag: "ProviderError", message: "model failed" },
    {
      _tag: "ToolDecodeError",
      toolCallId: "call_123",
      name: "read",
      message: "invalid input",
    },
    {
      _tag: "ToolExecutionError",
      toolCallId: "call_123",
      name: "read",
      message: "permission denied",
    },
    { _tag: "MaxStepsExceeded", maxSteps: 3 },
  ] as const) {
    const error = Schema.decodeUnknownSync(AgentError)(input);

    assert.strictEqual(error._tag, input._tag);
    assert.deepStrictEqual(Schema.encodeUnknownSync(AgentError)(error), input);
  }
});

it("decodes plain objects to tagged error instances", () => {
  assert.instanceOf(
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ProviderError",
      message: "model failed",
    }),
    ProviderError,
  );

  assert.instanceOf(
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolDecodeError",
      toolCallId: "call_123",
      name: "read",
      message: "invalid input",
    }),
    ToolDecodeError,
  );

  assert.instanceOf(
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolExecutionError",
      toolCallId: "call_123",
      name: "read",
      message: "permission denied",
    }),
    ToolExecutionError,
  );

  assert.instanceOf(
    Schema.decodeUnknownSync(AgentError)({
      _tag: "MaxStepsExceeded",
      maxSteps: 3,
    }),
    MaxStepsExceeded,
  );
});

it("encodes constructed tool errors as plain objects", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentError)(
      new ToolDecodeError({
        toolCallId,
        name: toolName,
        message: "invalid input",
      }),
    ),
    {
      _tag: "ToolDecodeError",
      toolCallId: "call_123",
      name: "read",
      message: "invalid input",
    },
  );
});

it("rejects malformed tool errors", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolDecodeError",
      toolCallId: "",
      name: "read",
      message: "invalid input",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolExecutionError",
      toolCallId: "call_123",
      name: "",
      message: "failed",
    }),
  );
});

it("rejects invalid max step counts", () => {
  for (const maxSteps of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() =>
      Schema.decodeUnknownSync(AgentError)({
        _tag: "MaxStepsExceeded",
        maxSteps,
      }),
    );
  }
});
