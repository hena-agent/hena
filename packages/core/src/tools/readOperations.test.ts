import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Option } from "effect";

import { readDirectory, readFile } from "./readOperations";

const info = (type: FileSystem.File.Type): FileSystem.File.Info => ({
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
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none(),
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
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({ readFileString: () => Effect.succeed("a\nb") }),
    ),
  ),
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
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({ readFileString: () => Effect.succeed("a\nb") }),
    ),
  ),
);

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
