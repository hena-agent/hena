import { assert, it } from "@effect/vitest";
import { Context, Effect, Path as EffectPath, FileSystem, Layer } from "effect";

import { PathGuard } from "../path/PathGuard";
import { ToolInputError } from "./toolErrors";
import { makeWriteAgentTool, WriteTool } from "./WriteTool";
import { ToolWorkspace } from "./workspace";

const workspace = ToolWorkspace.layer({ cwd: "/workspace" });

it.effect("writes content after PathGuard authorization", () => {
  const writes: Array<{ readonly path: string; readonly content: string }> = [];
  const authorized: Array<string> = [];

  return Effect.gen(function* () {
    const tool = yield* WriteTool;
    const result = yield* tool.execute({
      filePath: "/workspace/file.txt",
      content: "hello",
    });

    assert.deepStrictEqual(authorized, ["/workspace/file.txt"]);
    assert.deepStrictEqual(writes, [
      { path: "/workspace/file.txt", content: "hello" },
    ]);
    assert.deepStrictEqual(result.details, {
      path: "/workspace/file.txt",
      bytes: 5,
    });
  }).pipe(
    Effect.provide(WriteTool.Live),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path) =>
          Effect.sync(() => {
            authorized.push(path);
            return { canonicalPath: path, allowedBy: "workspace" } as const;
          }),
        authorizeCreateFile: (path) =>
          Effect.sync(() => {
            authorized.push(path);
            return { canonicalPath: path, allowedBy: "workspace" } as const;
          }),
        authorizeExistingPath: (path) =>
          Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "file",
          } as const),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        writeFileString: (path, content) =>
          Effect.sync(() => {
            writes.push({ path, content });
          }),
      }),
    ),
  );
});

it.effect("passes tool call context to PathGuard authorization", () => {
  const authorizedTools: Array<string | undefined> = [];

  return Effect.gen(function* () {
    const tool = yield* WriteTool;
    yield* tool.execute(
      {
        filePath: "/workspace/file.txt",
        content: "hello",
      },
      { toolCallId: "call-1", update: () => Effect.void },
    );

    assert.deepStrictEqual(authorizedTools, ["call-1"]);
  }).pipe(
    Effect.provide(WriteTool.Live),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path, options) =>
          Effect.sync(() => {
            authorizedTools.push(options?.tool?.callID);
            return { canonicalPath: path, allowedBy: "workspace" } as const;
          }),
        authorizeCreateFile: (path, options) =>
          Effect.sync(() => {
            authorizedTools.push(options?.tool?.callID);
            return { canonicalPath: path, allowedBy: "workspace" } as const;
          }),
        authorizeExistingPath: (path) =>
          Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
            kind: "file",
          } as const),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        writeFileString: () => Effect.void,
      }),
    ),
  );
});

it.effect("resolves relative write paths from the tool workspace", () => {
  const authorized: Array<string> = [];
  return Effect.gen(function* () {
    const tool = yield* WriteTool;
    yield* tool.execute({ filePath: "file.txt", content: "hello" });

    assert.deepStrictEqual(authorized, ["/workspace/file.txt"]);
  }).pipe(
    Effect.provide(WriteTool.Live),
    Effect.provide(workspace),
    Effect.provide(EffectPath.layer),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeCreateFile: (path) => {
          authorized.push(path);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "workspace",
          });
        },
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
        writeFileString: () => Effect.void,
      }),
    ),
  );
});

it.effect("rejects oversized write content before writing", () => {
  let wrote = false;
  return Effect.gen(function* () {
    const tool = yield* WriteTool;
    const error = yield* tool
      .execute({
        filePath: "/workspace/large.txt",
        content: "x".repeat(1024 * 1024 + 1),
      })
      .pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
    assert.strictEqual(error.message, "File is too large to write.");
    assert.strictEqual(wrote, false);
  }).pipe(
    Effect.provide(WriteTool.Live),
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
            kind: "file",
          }),
      }),
    ),
    Effect.provide(
      FileSystem.layerNoop({
        writeFileString: () =>
          Effect.sync(() => {
            wrote = true;
          }),
      }),
    ),
  );
});

it("adapts WriteTool to a pi AgentTool", async () => {
  const tool = makeWriteAgentTool(
    Context.make(WriteTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "Wrote file successfully." }],
          details: { path: "/workspace/file.txt", bytes: 5 },
        }),
    }),
  );

  const result = await tool.execute("call-1", {
    filePath: "/workspace/file.txt",
    content: "hello",
  });

  assert.deepStrictEqual(result.details, {
    path: "/workspace/file.txt",
    bytes: 5,
  });
});
