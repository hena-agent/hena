import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath } from "effect";

import { resolveWorkspacePath, ToolWorkspace } from "./workspace";

it.effect("resolves optional and relative paths from the tool cwd", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* resolveWorkspacePath(), "/workspace");
    assert.strictEqual(
      yield* resolveWorkspacePath("src/index.ts"),
      "/workspace/src/index.ts",
    );
    assert.strictEqual(yield* resolveWorkspacePath("/tmp/file"), "/tmp/file");
  }).pipe(
    Effect.provide(ToolWorkspace.layer({ cwd: "/workspace" })),
    Effect.provide(EffectPath.layer),
  ),
);
