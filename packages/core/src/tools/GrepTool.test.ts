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
import { GrepTool, makeGrepAgentTool } from "./GrepTool";
import { ToolInputError } from "./toolErrors";
import { ToolWorkspace } from "./workspace";

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

const makeLayer = GrepTool.Live.pipe(
  Layer.provideMerge(ToolWorkspace.layer({ cwd: "/workspace" })),
  Layer.provideMerge(EffectPath.layer),
  Layer.provideMerge(
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
  Layer.provideMerge(
    FileSystem.layerNoop({
      readDirectory: () => Effect.succeed(["src/a.ts", "README.md"]),
      readFileString: (path) =>
        Effect.succeed(
          path.endsWith("a.ts") ? "needle\nneedle" : "needle docs",
        ),
      realPath: (path) => Effect.succeed(path),
      stat: (path) =>
        Effect.succeed(
          path === "/workspace" ? info("Directory") : info("File"),
        ),
    }),
  ),
);

it.effect("greps files and groups line matches", () =>
  Effect.gen(function* () {
    const tool = yield* GrepTool;
    const result = yield* tool.execute(
      { pattern: "needle", include: "*.ts" },
      { toolCallId: "call-grep", update: () => Effect.void },
    );

    assert.deepStrictEqual(result.content, [
      {
        type: "text",
        text: "/workspace/src/a.ts:\n  Line 1: needle\n  Line 2: needle",
      },
    ]);
    assert.deepStrictEqual(result.details, { matches: 2, truncated: false });
  }).pipe(Effect.provide(makeLayer)),
);

it.effect("returns content for no grep matches", () =>
  Effect.gen(function* () {
    const tool = yield* GrepTool;
    const result = yield* tool.execute({ pattern: "missing" });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "No files found" },
    ]);
    assert.deepStrictEqual(result.details, { matches: 0, truncated: false });
  }).pipe(Effect.provide(makeLayer)),
);

it.effect("fails invalid regular expressions as typed tool input errors", () =>
  Effect.gen(function* () {
    const tool = yield* GrepTool;
    const error = yield* tool.execute({ pattern: "[" }).pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
  }).pipe(Effect.provide(makeLayer)),
);

it("adapts GrepTool to a pi AgentTool", async () => {
  const tool = makeGrepAgentTool(
    Context.make(GrepTool, {
      execute: () =>
        Effect.succeed({
          content: [
            { type: "text", text: "/workspace/a.ts:\n  Line 1: needle" },
          ],
          details: { matches: 1, truncated: false },
        }),
    }),
  );

  const result = await tool.execute("call-1", { pattern: "needle" });

  assert.deepStrictEqual(result.details, { matches: 1, truncated: false });
});
