import { Context, Effect, Path as EffectPath, Layer } from "effect";

import { PermissionService } from "../permission/PermissionService";
import type {
  PermissionDeniedError,
  PermissionTool,
} from "../permission/schema";
import { externalDirectoryPattern, isInsideRoot } from "./helpers";

export type PathGuardTargetKind = "file" | "directory";

export interface PathGuardAuthorizeOptions {
  readonly kind?: PathGuardTargetKind;
  readonly tool?: PermissionTool | undefined;
}

export interface PathGuardAuthorization {
  readonly allowedBy: "workspace" | "permission";
  readonly canonicalPath: string;
}

export interface PathGuardConfig {
  readonly canonicalize: (path: string) => Effect.Effect<string>;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
}

export interface PathGuardShape {
  readonly authorize: (
    path: string,
    options?: PathGuardAuthorizeOptions,
  ) => Effect.Effect<PathGuardAuthorization, PermissionDeniedError>;
}

const makePathGuard = Effect.fnUntraced(function* (config: PathGuardConfig) {
  const permission = yield* PermissionService;
  const pathService = yield* EffectPath.Path;
  const roots = yield* Effect.forEach(config.roots, config.canonicalize);
  const authorize = Effect.fnUntraced(function* (
    path: string,
    options?: PathGuardAuthorizeOptions,
  ) {
    const canonicalPath = yield* config.canonicalize(path);
    if (roots.some((root) => isInsideRoot(pathService, root, canonicalPath))) {
      return {
        canonicalPath,
        allowedBy: "workspace",
      } satisfies PathGuardAuthorization;
    }

    const kind = options?.kind ?? "file";
    const { parentDir, pattern } = externalDirectoryPattern(
      pathService,
      canonicalPath,
      kind,
    );
    yield* permission.ask({
      sessionID: config.sessionID,
      permission: "external_directory",
      patterns: [pattern],
      always: [pattern],
      metadata: { filepath: canonicalPath, parentDir },
      tool: options?.tool,
    });
    return {
      canonicalPath,
      allowedBy: "permission",
    } satisfies PathGuardAuthorization;
  });

  return { authorize } satisfies PathGuardShape;
});

export class PathGuard extends Context.Service<PathGuard, PathGuardShape>()(
  "@hena-dev/core/PathGuard",
) {
  static layer(
    config: PathGuardConfig,
  ): Layer.Layer<PathGuard, never, EffectPath.Path | PermissionService> {
    return Layer.effect(PathGuard)(makePathGuard(config));
  }
}
