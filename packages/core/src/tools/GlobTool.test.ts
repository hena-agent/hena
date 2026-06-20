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
import { GlobTool, makeGlobAgentTool } from "./GlobTool";
import { ToolWorkspace } from "./workspace";

const fileInfo = (type: FileSystem.File.Type): FileSystem.File.Info => ({
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

it.effect("returns absolute paths matching a glob", () =>
  Effect.gen(function* () {
    const tool = yield* GlobTool;
    const result = yield* tool.execute(
      { pattern: "**/*.ts" },
      { toolCallId: "call-glob", update: () => Effect.void },
    );

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "/workspace/src/a.ts\n/workspace/test/b.ts" },
    ]);
    assert.deepStrictEqual(result.details, { count: 2, truncated: false });
  }).pipe(
    Effect.provide(GlobTool.Live),
    Effect.provide(ToolWorkspace.layer({ cwd: "/workspace" })),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path, options) => {
          if (path === "/workspace") {
            assert.strictEqual(options?.kind, "directory");
            assert.strictEqual(options?.tool?.callID, "call-glob");
          }
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
          });
        },
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path) =>
          Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "file",
          }),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () =>
          Effect.succeed(["src/a.ts", "src/readme.md", "test/b.ts"]),
        realPath: (path) => Effect.succeed(path),
        stat: (path) =>
          Effect.succeed(
            path.endsWith(".ts") || path.endsWith(".md")
              ? fileInfo("File")
              : fileInfo("Directory"),
          ),
      }),
    ),
  ),
);

it.effect("returns content for no glob matches", () =>
  Effect.gen(function* () {
    const tool = yield* GlobTool;
    const result = yield* tool.execute({ pattern: "*.js" });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "No files found" },
    ]);
    assert.deepStrictEqual(result.details, { count: 0, truncated: false });
  }).pipe(
    Effect.provide(GlobTool.Live),
    Effect.provide(ToolWorkspace.layer({ cwd: "/workspace" })),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path) =>
          Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "file",
          }),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        readDirectory: () => Effect.succeed(["src/a.ts"]),
        realPath: (path) => Effect.succeed(path),
        stat: (path) =>
          Effect.succeed(
            path === "/workspace" ? fileInfo("Directory") : fileInfo("File"),
          ),
      }),
    ),
  ),
);

it("adapts GlobTool to a pi AgentTool", async () => {
  const tool = makeGlobAgentTool(
    Context.make(GlobTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "/workspace/a.ts" }],
          details: { count: 1, truncated: false },
        }),
    }),
  );

  const result = await tool.execute("call-1", { pattern: "*.ts" });

  assert.deepStrictEqual(result.details, { count: 1, truncated: false });
});
