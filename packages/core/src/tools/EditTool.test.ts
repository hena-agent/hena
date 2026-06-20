import { assert, it } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer } from "effect";

import { PathGuard } from "../path/PathGuard";
import { EditTool, makeEditAgentTool } from "./EditTool";

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
    Effect.provide(
      FileSystem.layerNoop({ readFileString: () => Effect.succeed("present") }),
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
