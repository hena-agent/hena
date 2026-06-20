import { assert, it } from "@effect/vitest";
import {
  Context,
  Effect,
  Path as EffectPath,
  FileSystem,
  Layer,
  Option,
} from "effect";

import { PathGuard } from "../path/PathGuard";
import { makeReadAgentTool, ReadTool } from "./ReadTool";

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

const pathGuard = Layer.succeed(PathGuard)({
  authorize: (path) =>
    Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
  authorizeCreateFile: (path) =>
    Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
  authorizeExistingPath: (path) =>
    Effect.succeed({
      canonicalPath: path,
      allowedBy: "workspace",
      kind: path === "/workspace" ? "directory" : "file",
    }),
});

it.effect("reads a line-limited file through PathGuard", () =>
  Effect.gen(function* () {
    const tool = yield* ReadTool;
    const result = yield* tool.execute(
      {
        filePath: "/workspace/file.txt",
        offset: 2,
        limit: 2,
      },
      { toolCallId: "call-read", update: () => Effect.void },
    );

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "2: two\n3: three" },
    ]);
    assert.deepStrictEqual(result.details, {
      path: "/workspace/file.txt",
      type: "file",
      lineStart: 2,
      lineEnd: 3,
      totalLines: 4,
      truncated: true,
    });
  }).pipe(
    Effect.provide(ReadTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(info("File")),
        readFileString: () => Effect.succeed("one\ntwo\nthree\nfour"),
      }),
    ),
  ),
);

it.effect("reads and sorts a directory", () =>
  Effect.gen(function* () {
    const tool = yield* ReadTool;
    const result = yield* tool.execute({ filePath: "/workspace" });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "a.txt\nsrc/" },
    ]);
    assert.deepStrictEqual(result.details, {
      path: "/workspace",
      type: "directory",
      entries: 2,
      truncated: false,
    });
  }).pipe(
    Effect.provide(ReadTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["src", "a.txt"]),
        stat: (path) =>
          Effect.succeed(
            path === "/workspace" || path.endsWith("src")
              ? info("Directory")
              : info("File"),
          ),
      }),
    ),
  ),
);

it.effect("uses PathGuard's existing-path boundary for directory reads", () => {
  const authorized: Array<string> = [];
  return Effect.gen(function* () {
    const tool = yield* ReadTool;
    yield* tool.execute({ filePath: "/workspace" });

    assert.deepStrictEqual(authorized, ["/workspace"]);
  }).pipe(
    Effect.provide(ReadTool.Live),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path) => {
          authorized.push(path);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "directory",
          });
        },
      }),
    ),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed([]),
        stat: () => Effect.succeed(info("Directory")),
      }),
    ),
  );
});

it("adapts ReadTool to a pi AgentTool", async () => {
  const tool = makeReadAgentTool(
    Context.make(ReadTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "1: hello" }],
          details: {
            path: "/workspace/file.txt",
            type: "file",
            lineStart: 1,
            lineEnd: 1,
            totalLines: 1,
            truncated: false,
          },
        }),
    }),
  );

  const result = await tool.execute("call-1", {
    filePath: "/workspace/file.txt",
  });

  assert.deepStrictEqual(result.content, [{ type: "text", text: "1: hello" }]);
});
