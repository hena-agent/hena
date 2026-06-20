import { Context, Effect, Path as EffectPath, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { PermissionService } from "../permission/PermissionService";
import { authorizeCanonicalPath, withPathGuardTool } from "./authorization";
import type {
  PathGuardAuthorizeOptions,
  PathGuardConfig,
  PathGuardExistingPathAuthorization,
  PathGuardShape,
  PathGuardTargetKind,
} from "./PathGuardTypes";
import { resolveWriteTarget } from "./writeTarget";

type PathGuardLayer = Layer.Layer<
  PathGuard,
  PlatformError,
  EffectPath.Path | PermissionService
>;

const defaultTargetKind = (): Effect.Effect<PathGuardTargetKind> =>
  Effect.succeed("file");

const makePathGuard = Effect.fnUntraced(function* (config: PathGuardConfig) {
  const permission = yield* PermissionService;
  const pathService = yield* EffectPath.Path;
  const roots = yield* Effect.forEach(config.roots, config.canonicalize);
  const getTargetKind = config.getTargetKind ?? defaultTargetKind;
  const authorizeCanonical = (
    canonicalPath: string,
    options: PathGuardAuthorizeOptions & { readonly kind: PathGuardTargetKind },
  ): ReturnType<typeof authorizeCanonicalPath> =>
    authorizeCanonicalPath({
      canonicalPath,
      options,
      pathService,
      permission,
      roots,
      sessionID: config.sessionID,
    });

  const authorize = Effect.fnUntraced(function* (
    path: string,
    options?: PathGuardAuthorizeOptions,
  ) {
    const canonicalPath = yield* config.canonicalize(path);
    return yield* authorizeCanonical(
      canonicalPath,
      withPathGuardTool(options?.kind ?? "file", options),
    );
  });

  const authorizeExistingPath = Effect.fnUntraced(function* (
    path: string,
    options?: Omit<PathGuardAuthorizeOptions, "kind">,
  ) {
    const canonicalPath = yield* config.canonicalize(path);
    const kind = yield* getTargetKind(canonicalPath);
    const authorization = yield* authorizeCanonical(
      canonicalPath,
      withPathGuardTool(kind, options),
    );
    return {
      ...authorization,
      kind,
    } satisfies PathGuardExistingPathAuthorization;
  });

  const authorizeCreateFile = Effect.fnUntraced(function* (
    path: string,
    options?: Omit<PathGuardAuthorizeOptions, "kind">,
  ) {
    const target = yield* resolveWriteTarget({
      canonicalize: config.canonicalize,
      path,
      pathExists: config.pathExists,
      pathService,
      readLink: config.readLink,
    });
    return yield* authorizeCanonical(
      target,
      withPathGuardTool("file", options),
    );
  });

  return {
    authorize,
    authorizeCreateFile,
    authorizeExistingPath,
  } satisfies PathGuardShape;
});

export class PathGuard extends Context.Service<PathGuard, PathGuardShape>()(
  "@hena-dev/core/PathGuard",
) {
  static layer(config: PathGuardConfig): PathGuardLayer {
    return Layer.effect(PathGuard)(makePathGuard(config));
  }
}
