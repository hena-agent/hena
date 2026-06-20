import { assert, it } from "@effect/vitest";
import { Context, Effect, Path as EffectPath, FileSystem, Layer } from "effect";

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
      FileSystem.layerNoop({ readFileString: () => Effect.succeed("present") }),
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
