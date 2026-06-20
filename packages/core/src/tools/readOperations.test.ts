import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Option, Stream } from "effect";

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
    const pathService = yield* EffectPath.Path;
    const result = yield* readDirectory(fs, pathService, "/workspace");

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
    Effect.provide(EffectPath.layer),
  ),
);
