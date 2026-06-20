import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Option } from "effect";

import { searchFiles } from "./files";

const matchAll = () => true;

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

it.effect("lists a single file root", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace/file.ts", {
      limit: 10,
      matches: matchAll,
    });
    assert.deepStrictEqual(result, {
      files: ["/workspace/file.ts"],
      truncated: false,
    });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(info("File")),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("lists files under a directory root", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 10,
      matches: matchAll,
    });
    assert.deepStrictEqual(result, {
      files: ["/workspace/a.ts", "/workspace/src/b.ts"],
      truncated: false,
    });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: (path) =>
          Effect.succeed(path === "/workspace" ? ["src", "a.ts"] : ["b.ts"]),
        stat: (path) =>
          Effect.succeed(
            path.endsWith(".ts") ? info("File") : info("Directory"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("ignores non-file and non-directory roots", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace/socket", {
      limit: 10,
      matches: matchAll,
    });
    assert.deepStrictEqual(result, { files: [], truncated: false });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(info("Socket")),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("ignores non-file and non-directory child entries", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 10,
      matches: matchAll,
    });

    assert.deepStrictEqual(result, { files: [], truncated: false });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["socket"]),
        stat: (path) =>
          Effect.succeed(
            path === "/workspace" ? info("Directory") : info("Socket"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("truncates matching files at the configured limit", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 1,
      matches: matchAll,
    });

    assert.deepStrictEqual(result, {
      files: ["/workspace/a.ts"],
      truncated: true,
    });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["a.ts", "b.ts"]),
        stat: (path) =>
          Effect.succeed(
            path === "/workspace" ? info("Directory") : info("File"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("stops visiting a directory after truncation", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 1,
      matches: matchAll,
    });

    assert.deepStrictEqual(result, {
      files: ["/workspace/src/a.ts"],
      truncated: true,
    });
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: (path) =>
          Effect.succeed(
            path === "/workspace" ? ["src"] : ["a.ts", "b.ts", "c.ts"],
          ),
        stat: (path) =>
          Effect.succeed(
            path.endsWith(".ts") ? info("File") : info("Directory"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);
