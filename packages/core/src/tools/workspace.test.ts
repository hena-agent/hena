import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath } from "effect";

import { resolvePath } from "./workspace";

it.effect("resolves optional and relative paths from the tool cwd", () =>
  Effect.gen(function* () {
    const pathService = yield* EffectPath.Path;

    assert.strictEqual(resolvePath(pathService, "/workspace"), "/workspace");
    assert.strictEqual(
      resolvePath(pathService, "/workspace", "src/index.ts"),
      "/workspace/src/index.ts",
    );
    assert.strictEqual(
      resolvePath(pathService, "/workspace", "/tmp/file"),
      "/tmp/file",
    );
  }).pipe(Effect.provide(EffectPath.layer)),
);
