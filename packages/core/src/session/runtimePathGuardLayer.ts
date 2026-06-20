import { Effect, type Path as EffectPath, FileSystem, Layer } from "effect";

import { PathGuard } from "../path/PathGuard";
import { PermissionService } from "../permission/PermissionService";
import type { SessionRuntimeConfig } from "./types";

export const makeRuntimePathGuardLayer = (
  config: SessionRuntimeConfig,
): Layer.Layer<
  PathGuard | PermissionService,
  unknown,
  FileSystem.FileSystem | EffectPath.Path
> =>
  Layer.unwrap(
    Effect.map(FileSystem.FileSystem, (fs) =>
      PathGuard.layer({
        sessionID: config.sessionID,
        roots: config.roots,
        canonicalize: (path: string) => fs.realPath(path).pipe(Effect.orDie),
      }).pipe(Layer.provideMerge(PermissionService.Live)),
    ),
  );
