import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Layer } from "effect";

import { PathGuard } from "../path/PathGuard";
import { makeDirectorySearchAuthorize } from "./directorySearchAuthorization";

it.effect(
  "scopes descendant search authorization to authorized directories",
  () => {
    const authorized: Array<string> = [];
    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const pathService = yield* EffectPath.Path;
      const pathGuard = yield* PathGuard;
      const authorize = makeDirectorySearchAuthorize({
        fs,
        pathGuard,
        pathService,
        root: "/workspace",
        rootKind: "directory",
      });

      yield* authorize("/workspace/a.ts");
      yield* authorize("/workspace/link");
      yield* authorize("/external/secret.ts");

      assert.deepStrictEqual(authorized, ["directory:/external"]);
    }).pipe(
      Effect.provide(EffectPath.layer),
      Effect.provide(
        FileSystem.layerNoop({
          realPath: (path) =>
            Effect.succeed(path === "/workspace/link" ? "/external" : path),
        }),
      ),
      Effect.provide(
        Layer.succeed(PathGuard)({
          authorize: (path, options) =>
            Effect.sync(() => {
              authorized.push(`${options?.kind ?? "file"}:${path}`);
              return { canonicalPath: path, allowedBy: "permission" };
            }),
          authorizeCreateFile: (path) =>
            Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
          authorizeExistingPath: (path) => {
            const kind = path === "/external" ? "directory" : "file";
            authorized.push(`${kind}:${path}`);
            return Effect.succeed({
              canonicalPath: path,
              allowedBy: "permission",
              kind,
            });
          },
        }),
      ),
    );
  },
);

it.effect("passes tool refs when authorizing file escapes", () => {
  const authorized: Array<string> = [];
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const pathGuard = yield* PathGuard;
    const authorize = makeDirectorySearchAuthorize({
      fs,
      pathGuard,
      pathService,
      root: "/workspace",
      rootKind: "directory",
      tool: { callID: "call-search" },
    });

    yield* authorize("/workspace/link-file");

    assert.deepStrictEqual(authorized, [
      "file:/external/secret.ts:call-search",
    ]);
  }).pipe(
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        realPath: () => Effect.succeed("/external/secret.ts"),
      }),
    ),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path, options) =>
          Effect.sync(() => {
            authorized.push(
              `${options?.kind ?? "file"}:${path}:${options?.tool?.callID ?? ""}`,
            );
            return { canonicalPath: path, allowedBy: "permission" };
          }),
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path, options) => {
          authorized.push(`file:${path}:${options?.tool?.callID ?? ""}`);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "permission",
            kind: "file",
          });
        },
      }),
    ),
  );
});

it.effect("keeps authorized file roots scoped to that file", () => {
  const authorized: Array<string> = [];
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const pathService = yield* EffectPath.Path;
    const pathGuard = yield* PathGuard;
    const authorize = makeDirectorySearchAuthorize({
      fs,
      pathGuard,
      pathService,
      root: "/external/secret.ts",
      rootKind: "file",
    });

    yield* authorize("/external/secret.ts");
    yield* authorize("/external/other.ts");

    assert.deepStrictEqual(authorized, ["file:/external/other.ts"]);
  }).pipe(
    Effect.provide(EffectPath.layer),
    Effect.provide(
      FileSystem.layerNoop({
        realPath: (path) => Effect.succeed(path),
      }),
    ),
    Effect.provide(
      Layer.succeed(PathGuard)({
        authorize: (path, options) =>
          Effect.sync(() => {
            authorized.push(`${options?.kind ?? "file"}:${path}`);
            return { canonicalPath: path, allowedBy: "permission" };
          }),
        authorizeCreateFile: (path) =>
          Effect.succeed({ canonicalPath: path, allowedBy: "workspace" }),
        authorizeExistingPath: (path) => {
          authorized.push(`file:${path}`);
          return Effect.succeed({
            canonicalPath: path,
            allowedBy: "permission",
            kind: "file",
          });
        },
      }),
    ),
  );
});
