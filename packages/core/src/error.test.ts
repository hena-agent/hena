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

it("preserves tool error names for diagnostics", () => {
  for (const error of [
    new ToolDecodeError({
      toolCallId,
      toolName,
      message: "invalid input",
    }),
    new ToolExecutionError({
      toolCallId,
      toolName,
      message: "failed",
    }),
  ] as const) {
    assert.strictEqual(error.name, error._tag);
    assert.strictEqual(String(error), `${error._tag}: ${error.message}`);
  }
});

it("round-trips every core agent error through its plain contract", () => {
  for (const { ctor, input } of [
    {
      ctor: ProviderError,
      input: { _tag: "ProviderError", message: "model failed" },
    },
    {
      ctor: ToolDecodeError,
      input: {
        _tag: "ToolDecodeError",
        toolCallId: "call_123",
        toolName: "read",
        message: "invalid input",
      },
    },
    {
      ctor: ToolExecutionError,
      input: {
        _tag: "ToolExecutionError",
        toolCallId: "call_123",
        toolName: "read",
        message: "permission denied",
      },
    },
    {
      ctor: MaxStepsExceeded,
      input: { _tag: "MaxStepsExceeded", maxSteps: 3 },
    },
  ] as const) {
    const error = Schema.decodeUnknownSync(AgentError)(input);

    assert.strictEqual(error instanceof ctor, true);
    assert.strictEqual(error._tag, input._tag);
    assert.deepStrictEqual(Schema.encodeUnknownSync(AgentError)(error), input);
  }
});

it("encodes constructed tool errors as plain objects", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentError)(
      new ToolDecodeError({
        toolCallId,
        toolName,
        message: "invalid input",
      }),
    ),
    {
      _tag: "ToolDecodeError",
      toolCallId: "call_123",
      toolName: "read",
      message: "invalid input",
    },
  );
});

it("rejects malformed tool errors", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolDecodeError",
      toolCallId: "",
      toolName: "read",
      message: "invalid input",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(AgentError)({
      _tag: "ToolExecutionError",
      toolCallId: "call_123",
      toolName: "",
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
