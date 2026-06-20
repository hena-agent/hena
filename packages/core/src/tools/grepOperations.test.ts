import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Stream } from "effect";

import { formatMatches } from "./grepFormat";
import {
  collectGrepScannedBytes,
  makeGrepCollectionState,
} from "./grepMatchCollector";
import { grepFile, grepFiles, makeIncludeMatcher } from "./grepOperations";

const fileLayer = (read: (path: string) => string) =>
  FileSystem.layerNoop({
    stream: (path) => Stream.make(new TextEncoder().encode(read(path))),
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
    }).pipe(Effect.provide(fileLayer(() => "needle"))),
);

it.effect("does not read files when the match limit is already reached", () => {
  let pulls = 0;
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(fs, /needle/, ["/workspace/a.ts"], 0);

    assert.deepStrictEqual(result, { matches: [], truncated: true });
    assert.strictEqual(pulls, 0);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stream: () =>
          Stream.make(new TextEncoder().encode("needle")).pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                pulls += 1;
              }),
            ),
          ),
      }),
    ),
  );
});

it.effect("propagates per-file grep truncation", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(fs, /needle/, ["/workspace/a.ts"], 1);

    assert.deepStrictEqual(result, {
      matches: [{ path: "/workspace/a.ts", line: 1, text: "needle" }],
      truncated: true,
    });
  }).pipe(Effect.provide(fileLayer(() => "needle\nneedle"))),
);

it.effect("greps matching lines from a file", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFile({
      fs,
      pattern: /needle/,
      file: "/workspace/a.ts",
      limit: 10,
    });

    assert.deepStrictEqual(result.matches, [
      { path: "/workspace/a.ts", line: 2, text: "needle" },
    ]);
    assert.strictEqual(result.truncated, false);
  }).pipe(Effect.provide(fileLayer(() => "hay\nneedle"))),
);

it.effect("reports truncated grep results", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFile({
      fs,
      pattern: /needle/,
      file: "/workspace/a.ts",
      limit: 1,
    });

    assert.deepStrictEqual(result.matches, [
      { path: "/workspace/a.ts", line: 1, text: "needle" },
    ]);
    assert.strictEqual(result.truncated, true);
  }).pipe(Effect.provide(fileLayer(() => "needle\nneedle"))),
);

it.effect("continues after truncated grep candidates", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(
      fs,
      /needle/,
      ["/workspace/large.log", "/workspace/a.ts"],
      10,
    );

    assert.deepStrictEqual(result, {
      matches: [{ path: "/workspace/a.ts", line: 1, text: "needle" }],
      truncated: true,
    });
  }).pipe(
    Effect.provide(
      fileLayer((path) =>
        path.endsWith("a.ts") ? "needle" : "x".repeat(1024 * 1024 + 1),
      ),
    ),
  ),
);

it.effect("caps collected grep output by bytes", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(fs, /needle/, ["/workspace/a.ts"], 10);
    const [match] = result.matches;

    assert.ok(match !== undefined);
    assert.strictEqual(result.truncated, true);
    assert.ok(match.text.length < 1024 * 1024);
  }).pipe(Effect.provide(fileLayer(() => `needle${"x".repeat(1024 * 1024)}`))),
);

it.effect("stops grepping empty-line files at the input byte cap", () => {
  let pulls = 0;
  const chunk = new TextEncoder().encode("\n".repeat(600_000));
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFile({
      fs,
      pattern: /needle/,
      file: "/workspace/large.log",
      limit: 10,
    });

    assert.strictEqual(result.truncated, true);
    assert.strictEqual(pulls, 2);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stream: () =>
          Stream.make(chunk, chunk, chunk).pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                pulls += 1;
              }),
            ),
          ),
      }),
    ),
  );
});

it.effect("stops no-match searches at the total scan byte budget", () => {
  let pulls = 0;
  const chunk = new TextEncoder().encode("x".repeat(1024 * 1024));
  const files = Array.from(
    { length: 20 },
    (_, index) => `/workspace/file-${index}.log`,
  );
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* grepFiles(fs, /needle/, files, 10);

    assert.deepStrictEqual(result.matches, []);
    assert.strictEqual(result.truncated, true);
    assert.strictEqual(pulls, 8);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stream: () =>
          Stream.make(chunk).pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                pulls += 1;
              }),
            ),
          ),
      }),
    ),
  );
});

it.effect(
  "marks a file grep truncated when the scan budget is exhausted",
  () => {
    const state = makeGrepCollectionState();
    collectGrepScannedBytes(state, 8 * 1024 * 1024);
    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const result = yield* grepFile({
        fs,
        pattern: /needle/,
        file: "/workspace/a.ts",
        limit: 10,
        scanState: state,
      });

      assert.deepStrictEqual(result.matches, []);
      assert.strictEqual(result.truncated, true);
    }).pipe(Effect.provide(fileLayer(() => "needle")));
  },
);

it("formats grouped grep matches", () => {
  assert.strictEqual(
    formatMatches([
      { path: "/workspace/a.ts", line: 1, text: "needle" },
      { path: "/workspace/a.ts", line: 2, text: "needle" },
      { path: "/workspace/b.ts", line: 1, text: "other" },
    ]).text,
    "/workspace/a.ts:\n  Line 1: needle\n  Line 2: needle\n/workspace/b.ts:\n  Line 1: other",
  );
});

it("truncates formatted grep output by bytes", () => {
  const result = formatMatches([
    { path: "/workspace/a.ts", line: 1, text: "x".repeat(1024 * 1024) },
  ]);

  assert.strictEqual(result.text.length, 1024 * 1024);
  assert.strictEqual(result.truncated, true);
});
