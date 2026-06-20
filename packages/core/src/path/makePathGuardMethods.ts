import { Effect, type Path as EffectPath } from "effect";

import { withPathGuardTool } from "./authorization";
import type { AuthorizeCanonical } from "./makeAuthorizeCanonical";
import type {
  PathGuardConfig,
  PathGuardExistingPathAuthorization,
  PathGuardShape,
} from "./PathGuardTypes";
import { resolveWriteTarget } from "./writeTarget";

interface MakeAuthorizeInput {
  readonly authorizeCanonical: AuthorizeCanonical;
  readonly canonicalize: PathGuardConfig["canonicalize"];
}

export const makeAuthorize = (
  input: MakeAuthorizeInput,
): PathGuardShape["authorize"] =>
  Effect.fnUntraced(function* (path, options) {
    const canonicalPath = yield* input.canonicalize(path);
    return yield* input.authorizeCanonical(
      canonicalPath,
      withPathGuardTool(
        options?.kind ?? "file",
        options?.operation ?? "read",
        options,
      ),
    );
  });

interface MakeAuthorizeExistingPathInput extends MakeAuthorizeInput {
  readonly getTargetKind: NonNullable<PathGuardConfig["getTargetKind"]>;
}

export const makeAuthorizeExistingPath = (
  input: MakeAuthorizeExistingPathInput,
): PathGuardShape["authorizeExistingPath"] =>
  Effect.fnUntraced(function* (path, options) {
    const canonicalPath = yield* input.canonicalize(path);
    const kind = yield* input.getTargetKind(canonicalPath);
    const authorization = yield* input.authorizeCanonical(
      canonicalPath,
      withPathGuardTool(kind, options?.operation ?? "read", options),
    );
    return {
      ...authorization,
      kind,
    } satisfies PathGuardExistingPathAuthorization;
  });

interface MakeAuthorizeCreateFileInput extends MakeAuthorizeInput {
  readonly pathExists: PathGuardConfig["pathExists"];
  readonly pathService: EffectPath.Path;
  readonly readLink: PathGuardConfig["readLink"];
}

export const makeAuthorizeCreateFile = (
  input: MakeAuthorizeCreateFileInput,
): PathGuardShape["authorizeCreateFile"] =>
  Effect.fnUntraced(function* (path, options) {
    const target = yield* resolveWriteTarget({
      canonicalize: input.canonicalize,
      path,
      pathExists: input.pathExists,
      pathService: input.pathService,
      readLink: input.readLink,
    });
    return yield* input.authorizeCanonical(
      target,
      withPathGuardTool("file", options?.operation ?? "create", options),
    );
  });
