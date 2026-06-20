import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import { ensureEditSize, measureEditTextBytes } from "./editBounds";
import { ToolInputError } from "./toolErrors";

it.effect("measures UTF-8 edit text without allocating encoded output", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* measureEditTextBytes("é", "Too large"), 2);
    assert.strictEqual(yield* measureEditTextBytes("€", "Too large"), 3);
    assert.strictEqual(yield* measureEditTextBytes("😀", "Too large"), 4);
    assert.strictEqual(yield* measureEditTextBytes("\uD800x", "Too large"), 4);
    assert.strictEqual(yield* measureEditTextBytes("\uD800", "Too large"), 3);
  }),
);

it.effect("rejects text that exceeds the edit byte cap", () =>
  Effect.gen(function* () {
    const error = yield* measureEditTextBytes(
      "€".repeat(400_000),
      "Too large",
    ).pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
    assert.strictEqual(error.message, "Too large");
  }),
);

it.effect("rejects file sizes that exceed the edit cap", () =>
  Effect.gen(function* () {
    const error = yield* ensureEditSize(FileSystem.MiB(2), "Too large").pipe(
      Effect.flip,
    );

    assert.ok(error instanceof ToolInputError);
  }),
);
