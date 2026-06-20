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

const fileLayer = (
  text: string,
  size = FileSystem.Size(text.length),
  reads?: Array<FileSystem.SizeInput | undefined>,
) =>
  FileSystem.layerNoop({
    stat: () => Effect.succeed(info("File", size)),
    stream: (_path, options) => {
      reads?.push(options?.bytesToRead);
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

it.effect("bounds file reads and marks truncated output", () => {
  const reads: Array<FileSystem.SizeInput | undefined> = [];
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const result = yield* readFile(fs, "/large.txt", {
      filePath: "/large.txt",
    });

    assert.deepStrictEqual(reads, [FileSystem.MiB(1)]);
    assert.strictEqual(result.details.truncated, true);
  }).pipe(Effect.provide(fileLayer("a\nb", FileSystem.MiB(2), reads)));
});

it.effect("marks directories with a slash", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* readDirectory(fs, pathService, "/workspace");

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "file.txt\nsrc/" },
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
