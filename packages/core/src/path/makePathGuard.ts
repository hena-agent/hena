import { Effect, Path as EffectPath } from "effect";

import { PermissionService } from "../permission/PermissionService";
import { makeAuthorizeCanonical } from "./makeAuthorizeCanonical";
import {
  makeAuthorize,
  makeAuthorizeCreateFile,
  makeAuthorizeExistingPath,
} from "./makePathGuardMethods";
import type {
  PathGuardConfig,
  PathGuardShape,
  PathGuardTargetKind,
} from "./PathGuardTypes";

const defaultTargetKind = (): Effect.Effect<PathGuardTargetKind> =>
  Effect.succeed("file");

export const makePathGuard = Effect.fnUntraced(function* (
  config: PathGuardConfig,
) {
  const permission = yield* PermissionService;
  const pathService = yield* EffectPath.Path;
  const roots = yield* Effect.forEach(config.roots, config.canonicalize);
  const getTargetKind = config.getTargetKind ?? defaultTargetKind;
  const authorizeCanonical = makeAuthorizeCanonical({
    pathService,
    permission,
    roots,
    sessionID: config.sessionID,
  });

  return {
    authorize: makeAuthorize({
      authorizeCanonical,
      canonicalize: config.canonicalize,
    }),
    authorizeCreateFile: makeAuthorizeCreateFile({
      authorizeCanonical,
      canonicalize: config.canonicalize,
      pathExists: config.pathExists,
      pathService,
      readLink: config.readLink,
    }),
    authorizeExistingPath: makeAuthorizeExistingPath({
      authorizeCanonical,
      canonicalize: config.canonicalize,
      getTargetKind,
    }),
  } satisfies PathGuardShape;
});
