import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem } from "effect";

import { collectProjectInstructions } from "./projectInstructions";

const fileLayer = (files: ReadonlyMap<string, string>) =>
  FileSystem.layerNoop({
    exists: (path) => Effect.succeed(files.has(path)),
    readFileString: (path) => Effect.succeed(files.get(path) ?? ""),
  });

it.effect("discovers ambient AGENTS and CLAUDE files from root to cwd", () =>
  Effect.gen(function* () {
    const instructions = yield* collectProjectInstructions({
      cwd: "/repo/packages/app",
      roots: ["/repo"],
    });

    assert.deepStrictEqual(instructions, [
      { path: "/repo/AGENTS.md", content: "root agents" },
      { path: "/repo/CLAUDE.md", content: "root claude" },
      { path: "/repo/packages/AGENTS.md", content: "packages agents" },
      { path: "/repo/packages/app/CLAUDE.md", content: "app claude" },
    ]);
  }).pipe(
    Effect.provide(
      fileLayer(
        new Map([
          ["/repo/AGENTS.md", "root agents"],
          ["/repo/CLAUDE.md", "root claude"],
          ["/repo/packages/AGENTS.md", "packages agents"],
          ["/repo/packages/app/CLAUDE.md", "app claude"],
          ["/outside/AGENTS.md", "outside"],
        ]),
      ),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect(
  "uses an explicit target directory for scoped nested instructions",
  () =>
    Effect.gen(function* () {
      const instructions = yield* collectProjectInstructions({
        cwd: "/repo",
        roots: ["/repo"],
        targetDirectory: "/repo/src/feature",
      });

      assert.deepStrictEqual(
        instructions.map((item) => item.path),
        [
          "/repo/AGENTS.md",
          "/repo/src/CLAUDE.md",
          "/repo/src/feature/AGENTS.md",
        ],
      );
    }).pipe(
      Effect.provide(
        fileLayer(
          new Map([
            ["/repo/AGENTS.md", "root"],
            ["/repo/src/CLAUDE.md", "src"],
            ["/repo/src/feature/AGENTS.md", "feature"],
          ]),
        ),
      ),
      Effect.provide(EffectPath.layer),
    ),
);

it.effect("returns no instructions when the target is outside all roots", () =>
  Effect.gen(function* () {
    const instructions = yield* collectProjectInstructions({
      cwd: "/outside",
      roots: ["/repo"],
    });

    assert.deepStrictEqual(instructions, []);
  }).pipe(
    Effect.provide(
      fileLayer(new Map([["/repo/AGENTS.md", "root should not apply"]])),
    ),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("falls back to cwd when roots are empty", () =>
  Effect.gen(function* () {
    const instructions = yield* collectProjectInstructions({
      cwd: "/repo",
      roots: [],
    });

    assert.deepStrictEqual(instructions, [
      { path: "/repo/AGENTS.md", content: "root" },
    ]);
  }).pipe(
    Effect.provide(fileLayer(new Map([["/repo/AGENTS.md", "root"]]))),
    Effect.provide(EffectPath.layer),
  ),
);

it.effect("resolves relative roots and target directories from cwd", () =>
  Effect.gen(function* () {
    const instructions = yield* collectProjectInstructions({
      cwd: "/repo",
      roots: ["."],
      targetDirectory: "src",
    });

    assert.deepStrictEqual(instructions, [
      { path: "/repo/src/CLAUDE.md", content: "src" },
    ]);
  }).pipe(
    Effect.provide(fileLayer(new Map([["/repo/src/CLAUDE.md", "src"]]))),
    Effect.provide(EffectPath.layer),
  ),
);
