import { Context, type Path as EffectPath, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";

import type { PermissionService } from "../permission/PermissionService";
import { makePathGuard } from "./makePathGuard";
import type { PathGuardConfig, PathGuardShape } from "./PathGuardTypes";

type PathGuardLayer = Layer.Layer<
  PathGuard,
  PlatformError,
  EffectPath.Path | PermissionService
>;

export class PathGuard extends Context.Service<PathGuard, PathGuardShape>()(
  "@hena-dev/core/PathGuard",
) {
  static layer(config: PathGuardConfig): PathGuardLayer {
    return Layer.effect(PathGuard)(makePathGuard(config));
  }
}
