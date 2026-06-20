import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import {
  formatMatches,
  grepFile,
  grepFiles,
  makeIncludeMatcher,
} from "./grepOperations";

it("matches include globs against relative paths and basenames", () => {
  assert.strictEqual(makeIncludeMatcher()("src/a.ts", "a.ts"), true);
  assert.strictEqual(makeIncludeMatcher("src/*.ts")("src/a.ts", "a.ts"), true);
  assert.strictEqual(makeIncludeMatcher("*.ts")("src/a.ts", "a.ts"), true);
  assert.strictEqual(makeIncludeMatcher("*.md")("src/a.ts", "a.ts"), false);
});

it.effect(
  "truncates before reading another file when the limit is reached",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const result = yield* grepFiles(
        fs,
        /needle/,
        ["/workspace/a.ts", "/workspace/b.ts"],
        1,
      );

      assert.deepStrictEqual(result, {
        matches: [{ path: "/workspace/a.ts", line: 1, text: "needle" }],
        truncated: true,
      });
    }).pipe(
      Effect.provide(
        FileSystem.layerNoop({
          readFileString: () => Effect.succeed("needle"),
        }),
      ),
    ),
);

it.effect("propagates per-file grep truncation", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(fs, /needle/, ["/workspace/a.ts"], 1);

    assert.deepStrictEqual(result, {
      matches: [{ path: "/workspace/a.ts", line: 1, text: "needle" }],
      truncated: true,
    });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readFileString: () => Effect.succeed("needle\nneedle"),
      }),
    ),
  ),
);

it.effect("greps matching lines from a file", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFile(fs, /needle/, "/workspace/a.ts", 10);

    assert.deepStrictEqual(result.matches, [
      { path: "/workspace/a.ts", line: 2, text: "needle" },
    ]);
    assert.strictEqual(result.truncated, false);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readFileString: () => Effect.succeed("hay\nneedle"),
      }),
    ),
  ),
);

it.effect("reports truncated grep results", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFile(fs, /needle/, "/workspace/a.ts", 1);

    assert.deepStrictEqual(result.matches, [
      { path: "/workspace/a.ts", line: 1, text: "needle" },
    ]);
    assert.strictEqual(result.truncated, true);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readFileString: () => Effect.succeed("needle\nneedle"),
      }),
    ),
  ),
);

it("formats grouped grep matches", () => {
  assert.strictEqual(
    formatMatches([
      { path: "/workspace/a.ts", line: 1, text: "needle" },
      { path: "/workspace/a.ts", line: 2, text: "needle" },
    ]),
    "/workspace/a.ts:\n  Line 1: needle\n  Line 2: needle",
  );
});
