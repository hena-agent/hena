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

it.effect("returns no file-root result when the root does not match", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace/file.ts", {
      limit: 10,
      matches: () => false,
    });

    assert.deepStrictEqual(result, { files: [], truncated: false });
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

it.effect("authorizes directories and matching file candidates", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const authorized: Array<string> = [];
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 10,
      matches: (candidate) => candidate.relativePath.endsWith(".ts"),
      authorize: (path, kind) =>
        Effect.sync(() => {
          authorized.push(`${kind}:${path}`);
          return { canonicalPath: path };
        }),
    });

    assert.deepStrictEqual(result.files, ["/workspace/a.ts"]);
    assert.deepStrictEqual(authorized, [
      "directory:/workspace",
      "file:/workspace/a.ts",
    ]);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["a.ts", "README.md"]),
        stat: (path) =>
          Effect.succeed(
            path === "/workspace" ? info("Directory") : info("File"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("authorizes symlinked directories before reading them", () => {
  const readDirectories: Array<string> = [];
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const result = yield* searchFiles(fs, pathService, "/workspace", {
      limit: 10,
      matches: matchAll,
      authorize: (path, kind) =>
        Effect.succeed({
          canonicalPath:
            kind === "directory" && path.startsWith("/workspace/link")
              ? "/external"
              : path,
        }),
    });

    assert.deepStrictEqual(result.files, ["/external/secret.ts"]);
    assert.deepStrictEqual(readDirectories, ["/workspace", "/external"]);
  }).pipe(
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: (path) =>
          Effect.sync(() => {
            readDirectories.push(path);
            return path === "/workspace"
              ? ["link", "link-again"]
              : ["secret.ts"];
          }),
        stat: (path) =>
          Effect.succeed(
            path.endsWith(".ts") ? info("File") : info("Directory"),
          ),
      }),
    ),
    Effect.provide(EffectPath.layer),
  );
});
