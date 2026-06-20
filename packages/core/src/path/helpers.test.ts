import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath } from "effect";

import { externalDirectoryPattern, isInsideRoot } from "./helpers";

it.effect("detects paths inside and outside a root", () =>
  Effect.gen(function* () {
    const pathService = yield* EffectPath.Path;

    assert.strictEqual(isInsideRoot(pathService, "/root", "/root"), true);
    assert.strictEqual(isInsideRoot(pathService, "/root", "/root/file"), true);
    assert.strictEqual(isInsideRoot(pathService, "/root", "/other"), false);
  }).pipe(Effect.provide(EffectPath.layer)),
);

it.effect("builds external directory glob patterns", () =>
  Effect.gen(function* () {
    const pathService = yield* EffectPath.Path;

    assert.deepStrictEqual(
      externalDirectoryPattern(pathService, "/outside/file.txt", "file"),
      { parentDir: "/outside", pattern: "/outside/*" },
    );
    assert.deepStrictEqual(
      externalDirectoryPattern(pathService, "/outside", "directory"),
      { parentDir: "/outside", pattern: "/outside/*" },
    );
  }).pipe(Effect.provide(EffectPath.layer)),
);
