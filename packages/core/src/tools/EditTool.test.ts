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
import { EditTool, makeEditAgentTool } from "./EditTool";
import { ToolInputError } from "./toolErrors";
import { ToolWorkspace } from "./workspace";

const pathGuard = Layer.succeed(PathGuard)({
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
});

const workspace = ToolWorkspace.layer({ cwd: "/workspace" });

const fileInfo = (size = FileSystem.Size(0)): FileSystem.File.Info => ({
  type: "File",
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

it.effect(
  "replaces a unique exact string after PathGuard authorization",
  () => {
    const writes: Array<{ readonly path: string; readonly content: string }> =
      [];

    return Effect.gen(function* () {
      const tool = yield* EditTool;
      const result = yield* tool.execute(
        {
          filePath: "/workspace/app.ts",
          oldString: "const value = 1;",
          newString: "const value = 2;",
        },
        {
          toolCallId: "call-edit",
          update: () => Effect.void,
        },
      );

      assert.deepStrictEqual(writes, [
        { path: "/workspace/app.ts", content: "const value = 2;\n" },
      ]);
      assert.deepStrictEqual(result.details, {
        path: "/workspace/app.ts",
        replacements: 1,
        bytes: 17,
      });
    }).pipe(
      Effect.provide(EditTool.Live),
      Effect.provide(pathGuard),
      Effect.provide(workspace),
      Effect.provide(EffectPath.layer),
      Effect.provide(
        FileSystem.layerNoop({
          stat: () => Effect.succeed(fileInfo()),
          readFileString: () => Effect.succeed("const value = 1;\n"),
          writeFileString: (path, content) =>
            Effect.sync(() => {
              writes.push({ path, content });
            }),
        }),
      ),
    );
  },
);

it.effect(
  "allows replacement text to contain the original unique match",
  () => {
    const writes: Array<{ readonly path: string; readonly content: string }> =
      [];

    return Effect.gen(function* () {
      const tool = yield* EditTool;
      const result = yield* tool.execute({
        filePath: "/workspace/app.ts",
        oldString: "foo",
        newString: "foobar",
      });

      assert.deepStrictEqual(writes, [
        { path: "/workspace/app.ts", content: "foobar\n" },
      ]);
      assert.strictEqual(result.details.replacements, 1);
    }).pipe(
      Effect.provide(EditTool.Live),
      Effect.provide(pathGuard),
      Effect.provide(workspace),
      Effect.provide(EffectPath.layer),
      Effect.provide(
        FileSystem.layerNoop({
          stat: () => Effect.succeed(fileInfo()),
          readFileString: () => Effect.succeed("foo\n"),
          writeFileString: (path, content) =>
            Effect.sync(() => {
              writes.push({ path, content });
            }),
        }),
      ),
    );
  },
);

it.effect("rejects ambiguous matches", () =>
  Effect.gen(function* () {
    const tool = yield* EditTool;
    const exit = yield* tool
      .execute({
        filePath: "/workspace/app.ts",
        oldString: "same",
        newString: "next",
      })
      .pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(fileInfo()),
        readFileString: () => Effect.succeed("same same"),
      }),
    ),
  ),
);

it.effect("rejects edits when the exact string is missing", () =>
  Effect.gen(function* () {
    const tool = yield* EditTool;
    const exit = yield* tool
      .execute({
        filePath: "/workspace/app.ts",
        oldString: "missing",
        newString: "next",
      })
      .pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(fileInfo()),
        readFileString: () => Effect.succeed("present"),
      }),
    ),
  ),
);

it.effect("resolves relative edit paths from the tool workspace", () => {
  const authorized: Array<string> = [];
  return Effect.gen(function* () {
    const tool = yield* EditTool;
    yield* tool.execute({
      filePath: "app.ts",
      oldString: "before",
      newString: "after",
    });

    assert.deepStrictEqual(authorized, ["/workspace/app.ts"]);
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path) => {
          authorized.push(path);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
          });
        },
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path) => {
          authorized.push(path);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "file",
          });
        },
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(fileInfo()),
        readFileString: () => Effect.succeed("before"),
        writeFileString: () => Effect.void,
      }),
    ),
  );
});

it.effect("rejects edit targets that are not files", () =>
  Effect.gen(function* () {
    const tool = yield* EditTool;
    const error = yield* tool
      .execute({
        filePath: "/workspace/src",
        oldString: "before",
        newString: "after",
      })
      .pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(workspace),
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
            kind: "directory",
          }),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({ readFileString: () => Effect.die("") }),
    ),
  ),
);

it.effect("rejects oversized edit targets before reading", () =>
  Effect.gen(function* () {
    const tool = yield* EditTool;
    const error = yield* tool
      .execute({
        filePath: "/workspace/large.log",
        oldString: "before",
        newString: "after",
      })
      .pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
    assert.strictEqual(error.message, "File is too large to edit.");
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(fileInfo(FileSystem.MiB(2))),
        readFileString: () => Effect.die("large file should not be read"),
      }),
    ),
  ),
);

it.effect("rejects oversized edit results before writing", () => {
  let wrote = false;
  return Effect.gen(function* () {
    const tool = yield* EditTool;
    const error = yield* tool
      .execute({
        filePath: "/workspace/app.ts",
        oldString: "small",
        newString: "x".repeat(1024 * 1024 + 1),
      })
      .pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
    assert.strictEqual(error.message, "Edited file is too large to write.");
    assert.strictEqual(wrote, false);
  }).pipe(
    Effect.provide(EditTool.Live),
    Effect.provide(pathGuard),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        stat: () => Effect.succeed(fileInfo()),
        readFileString: () => Effect.succeed("small"),
        writeFileString: () =>
          Effect.sync(() => {
            wrote = true;
          }),
      }),
    ),
  );
});

it("adapts EditTool to a pi AgentTool", async () => {
  const tool = makeEditAgentTool(
    Context.make(EditTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "Edited file successfully." }],
          details: { path: "/workspace/app.ts", replacements: 1, bytes: 5 },
        }),
    }),
  );

  const result = await tool.execute("call-1", {
    filePath: "/workspace/app.ts",
    oldString: "before",
    newString: "after",
  });

  assert.deepStrictEqual(result.details, {
    path: "/workspace/app.ts",
    replacements: 1,
    bytes: 5,
  });
});
