import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, Fiber, Layer } from "effect";

import { PermissionService } from "../permission/PermissionService";
import { PathGuard } from "./PathGuard";

const canonicalize = (path: string): Effect.Effect<string> =>
  Effect.succeed(path);

const providePathGuard = (roots: ReadonlyArray<string>) =>
  PathGuard.layer({
    sessionID: "session-1",
    roots,
    canonicalize,
  }).pipe(
    Layer.provideMerge(PermissionService.Live),
    Layer.provideMerge(EffectPath.layer),
  );

it.effect("authorizes exact and nested paths within configured roots", () =>
  Effect.gen(function* () {
    const guard = yield* PathGuard;
    const permissions = yield* PermissionService;

    const exact = yield* guard.authorize("/workspace", { kind: "directory" });
    const nested = yield* guard.authorize("/workspace/src/index.ts");

    assert.deepStrictEqual(exact, {
      canonicalPath: "/workspace",
      allowedBy: "workspace",
    });
    assert.deepStrictEqual(nested, {
      canonicalPath: "/workspace/src/index.ts",
      allowedBy: "workspace",
    });
    assert.deepStrictEqual(yield* permissions.list(), []);
  }).pipe(Effect.provide(providePathGuard(["/workspace"]))),
);

it.effect(
  "asks PermissionService for file paths outside configured roots",
  () =>
    Effect.gen(function* () {
      const guard = yield* PathGuard;
      const permissions = yield* PermissionService;
      const fiber = yield* guard
        .authorize("/outside/file.txt")
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const [request] = yield* permissions.list();
      if (request === undefined) {
        throw new Error("expected a pending permission request");
      }

      assert.strictEqual(request.permission, "external_directory");
      assert.deepStrictEqual(request.patterns, ["/outside/*"]);
      assert.deepStrictEqual(request.metadata, {
        filepath: "/outside/file.txt",
        parentDir: "/outside",
      });

      yield* permissions.grant({ requestID: request.id, scope: "once" });
      const result = yield* Fiber.join(fiber);

      assert.deepStrictEqual(result, {
        canonicalPath: "/outside/file.txt",
        allowedBy: "permission",
      });
    }).pipe(Effect.provide(providePathGuard(["/workspace"]))),
);

it.effect("asks for directory targets and propagates permission denial", () =>
  Effect.gen(function* () {
    const guard = yield* PathGuard;
    const permissions = yield* PermissionService;
    const fiber = yield* guard
      .authorize("/workspace", {
        kind: "directory",
        tool: { callID: "call-1" },
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [request] = yield* permissions.list();
    if (request === undefined) {
      throw new Error("expected a pending permission request");
    }

    assert.deepStrictEqual(request.patterns, ["/workspace/*"]);
    assert.strictEqual(request.tool?.callID, "call-1");

    yield* permissions.deny({ requestID: request.id, message: "No" });
    const exit = yield* Fiber.join(fiber).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }).pipe(Effect.provide(providePathGuard(["/workspace/root"]))),
);

it.effect(
  "uses canonical paths so symlink-like escapes require permission",
  () =>
    Effect.gen(function* () {
      const guard = yield* PathGuard;
      const permissions = yield* PermissionService;
      const fiber = yield* guard
        .authorize("/workspace/link/secret.txt")
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const [request] = yield* permissions.list();
      if (request === undefined) {
        throw new Error("expected a pending permission request");
      }

      assert.deepStrictEqual(request.metadata, {
        filepath: "/secret.txt",
        parentDir: "/",
      });

      yield* permissions.deny({ requestID: request.id, message: "No" });
      yield* Fiber.join(fiber).pipe(Effect.exit);
    }).pipe(
      Effect.provide(
        PathGuard.layer({
          sessionID: "session-1",
          roots: ["/workspace"],
          canonicalize: (path) =>
            Effect.succeed(
              path === "/workspace/link/secret.txt" ? "/secret.txt" : path,
            ),
        }).pipe(
          Layer.provideMerge(PermissionService.Live),
          Layer.provideMerge(EffectPath.layer),
        ),
      ),
    ),
);
