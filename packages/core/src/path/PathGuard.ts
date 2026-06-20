import { Context, Effect, Path as EffectPath, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { PermissionService } from "../permission/PermissionService";
import { authorizeCanonicalPath } from "./authorization";
import type {
  PathGuardAuthorizeOptions,
  PathGuardConfig,
  PathGuardExistingPathAuthorization,
  PathGuardShape,
  PathGuardTargetKind,
} from "./PathGuardTypes";

export type * from "./PathGuardTypes";

const defaultTargetKind = (): Effect.Effect<PathGuardTargetKind> =>
  Effect.succeed("file");

const withTool = (
  kind: PathGuardTargetKind,
  options?: Omit<PathGuardAuthorizeOptions, "kind">,
): PathGuardAuthorizeOptions & { readonly kind: PathGuardTargetKind } =>
  options?.tool === undefined ? { kind } : { kind, tool: options.tool };

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
      withTool(options?.kind ?? "file", options),
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
      withTool(kind, options),
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
    const parent = yield* config.canonicalize(pathService.dirname(path));
    const target = pathService.join(parent, pathService.basename(path));
    return yield* authorizeCanonical(target, withTool("file", options));
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
  static layer(
    config: PathGuardConfig,
  ): Layer.Layer<
    PathGuard,
    PlatformError,
    EffectPath.Path | PermissionService
  > {
    return Layer.effect(PathGuard)(makePathGuard(config));
  }
}
