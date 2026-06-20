import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Option } from "effect";

import {
  formatMatches,
  grepFile,
  grepFiles,
  makeIncludeMatcher,
} from "./grepOperations";

const fileInfo = (): FileSystem.File.Info => ({
  type: "File",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none(),
});

it.effect("matches include globs against relative paths and basenames", () =>
  Effect.gen(function* () {
    const all = yield* makeIncludeMatcher();
    const nested = yield* makeIncludeMatcher("src/*.ts");
    const basename = yield* makeIncludeMatcher("*.ts");
    const miss = yield* makeIncludeMatcher("*.md");

    assert.strictEqual(all("src/a.ts", "a.ts"), true);
    assert.strictEqual(nested("src/a.ts", "a.ts"), true);
    assert.strictEqual(basename("src/a.ts", "a.ts"), true);
    assert.strictEqual(miss("src/a.ts", "a.ts"), false);
  }),
);

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
          stat: () => Effect.succeed(fileInfo()),
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
        stat: () => Effect.succeed(fileInfo()),
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
        stat: () => Effect.succeed(fileInfo()),
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
        stat: () => Effect.succeed(fileInfo()),
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
