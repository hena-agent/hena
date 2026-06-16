import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  MaxStepsExceeded,
  ProviderError,
  ToolDecodeError,
  ToolExecutionError,
} from "./error";

it("ProviderError is a tagged, message-bearing Error", () => {
  const error = new ProviderError({ message: "model exploded" });
  assert.strictEqual(error._tag, "ProviderError");
  assert.strictEqual(error.message, "model exploded");
  assert.instanceOf(error, Error);
});

it("ToolDecodeError records the offending tool", () => {
  const error = new ToolDecodeError({
    toolName: "bash",
    message: "missing 'command'",
  });
  assert.strictEqual(error._tag, "ToolDecodeError");
  assert.strictEqual(error.toolName, "bash");
});

it("ToolExecutionError can carry an underlying cause", () => {
  const cause = new Error("ENOENT");
  const error = new ToolExecutionError({
    toolName: "read",
    message: "no such file",
    cause,
  });
  assert.strictEqual(error._tag, "ToolExecutionError");
  assert.strictEqual(error.cause, cause);
});

it("MaxStepsExceeded reports the step ceiling", () => {
  const error = new MaxStepsExceeded({ steps: 32 });
  assert.strictEqual(error._tag, "MaxStepsExceeded");
  assert.strictEqual(error.steps, 32);
});

it.effect("errors are yieldable typed failures", () =>
  Effect.gen(function* () {
    const failure = yield* Effect.flip(
      Effect.gen(function* () {
        return yield* new ProviderError({ message: "boom" });
      }),
    );
    assert.strictEqual(failure._tag, "ProviderError");
  }),
);
