import { Effect, type Path as EffectPath, FileSystem, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { PathGuard } from "../path/PathGuard";
import { PermissionService } from "../permission/PermissionService";
import type { SessionRuntimeConfig } from "./types";

export const makeRuntimePathGuardLayer = (
  config: SessionRuntimeConfig,
  sessionID: string,
): Layer.Layer<
  PathGuard | PermissionService,
  PlatformError,
  FileSystem.FileSystem | EffectPath.Path
> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return PathGuard.layer({
        sessionID,
        roots: config.roots,
        canonicalize: (path: string) => fs.realPath(path),
        getTargetKind: (path: string) =>
          fs
            .stat(path)
            .pipe(
              Effect.map((info) =>
                info.type === "Directory" ? "directory" : "file",
              ),
            ),
      }).pipe(Layer.provideMerge(PermissionService.Live));
    }),
  );
