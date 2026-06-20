import { Effect, type Path as EffectPath, FileSystem, Layer } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { PathGuard } from "../path/PathGuard";
import { PermissionService } from "../permission/PermissionService";
import { getSessionID, type SessionMetadataError } from "./sessionID";
import type { SessionRuntimeConfig } from "./types";

export const makeRuntimePathGuardLayer = (
  config: SessionRuntimeConfig,
): Layer.Layer<
  PathGuard | PermissionService,
  PlatformError | SessionMetadataError,
  FileSystem.FileSystem | EffectPath.Path
> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const sessionID = yield* getSessionID(config.session);
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
