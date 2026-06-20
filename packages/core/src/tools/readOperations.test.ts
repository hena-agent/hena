import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Option, Stream } from "effect";

import { readDirectory, readFile } from "./readOperations";

const info = (
  type: FileSystem.File.Type,
  size = FileSystem.Size(0),
): FileSystem.File.Info => ({
  type,
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
  size,
  blksize: Option.none(),
  blocks: Option.none(),
});

const fileLayer = (text: string, size = FileSystem.Size(text.length)) =>
  FileSystem.layerNoop({
    stat: () => Effect.succeed(info("File", size)),
    stream: (_path, options) => {
      const encoded = new TextEncoder().encode(text);
      const limit =
        options?.bytesToRead === undefined
          ? encoded.byteLength
          : Number(options.bytesToRead);
      return Stream.make(encoded.slice(0, limit));
    },
  });

it.effect("formats file lines", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/file.txt", {
      filePath: "/file.txt",
      offset: 1,
      limit: 1,
    });

    assert.deepStrictEqual(result.content, [{ type: "text", text: "1: a" }]);
  }).pipe(Effect.provide(fileLayer("a\nb"))),
);

it.effect("uses default file line range", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/file.txt", { filePath: "/file.txt" });

    assert.deepStrictEqual(result.details, {
      path: "/file.txt",
      type: "file",
      lineStart: 1,
      lineEnd: 2,
      totalLines: 2,
      truncated: false,
    });
  }).pipe(Effect.provide(fileLayer("a\nb"))),
);

it.effect("trims carriage returns from CRLF lines", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/file.txt", { filePath: "/file.txt" });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "1: a\n2: b" },
    ]);
  }).pipe(Effect.provide(fileLayer("a\r\nb"))),
);

it.effect("streams to requested offsets beyond the first MiB", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const prefixLines = 300_000;
    const result = yield* readFile(fs, "/large.txt", {
      filePath: "/large.txt",
      offset: prefixLines + 1,
      limit: 1,
    });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "300001: target" },
    ]);
    assert.strictEqual(result.details.truncated, false);
  }).pipe(Effect.provide(fileLayer(`${"skip\n".repeat(300_000)}target`))),
);

it.effect("marks oversized selected output as truncated", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/large.txt", {
      filePath: "/large.txt",
    });

    assert.strictEqual(result.details.truncated, true);
  }).pipe(Effect.provide(fileLayer("x".repeat(Number(FileSystem.MiB(1)) + 1)))),
);

it.effect("stops streaming long lines after the selected byte cap", () => {
  let pulls = 0;
  const chunk = new TextEncoder().encode("x".repeat(600_000));
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/large.txt", {
      filePath: "/large.txt",
    });

    assert.strictEqual(result.details.truncated, true);
    assert.strictEqual(pulls, 2);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(info("File")),
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

it.effect(
  "stops appending lines after selected output reaches the byte cap",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const result = yield* readFile(fs, "/large.txt", {
        filePath: "/large.txt",
      });
      const [content] = result.content;
      if (content?.type !== "text") {
        throw new Error("expected text content");
      }

      assert.strictEqual(content.text.includes("2: next"), false);
      assert.strictEqual(result.details.truncated, true);
    }).pipe(
      Effect.provide(
        fileLayer(`${"x".repeat(Number(FileSystem.MiB(1)) + 1)}\nnext`),
      ),
    ),
);

it.effect("lists directory entries without probing children", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readDirectory(fs, "/workspace");

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "file.txt\nsrc" },
    ]);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["src", "file.txt"]),
        stat: (path) =>
          Effect.succeed(
            path.endsWith("src") ? info("Directory") : info("File"),
          ),
      }),
    ),
  ),
);

it.effect("truncates oversized directory listings", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readDirectory(fs, "/workspace");
    const [content] = result.content;
    if (content?.type !== "text") {
      throw new Error("expected text content");
    }

    assert.strictEqual(content.text.length, 1024 * 1024);
    assert.strictEqual(result.details.truncated, true);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["x".repeat(1024 * 1024 + 1)]),
      }),
    ),
  ),
);
