import { Effect, type Path as EffectPath } from "effect";

import type { PermissionServiceShape } from "../permission/types";
import { externalDirectoryPattern, isInsideRoot } from "./helpers";
import type {
  PathGuardAuthorization,
  PathGuardAuthorizeOptions,
  PathGuardOperation,
  PathGuardTargetKind,
} from "./PathGuardTypes";

interface AuthorizeCanonicalPathInput {
  readonly canonicalPath: string;
  readonly options: PathGuardAuthorizeOptions & {
    readonly kind: PathGuardTargetKind;
    readonly operation: PathGuardOperation;
  };
  readonly pathService: EffectPath.Path;
  readonly permission: PermissionServiceShape;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
}

export const withPathGuardTool = (
  kind: PathGuardTargetKind,
  operation: PathGuardOperation,
  options?: Omit<PathGuardAuthorizeOptions, "kind">,
): PathGuardAuthorizeOptions & {
  readonly kind: PathGuardTargetKind;
  readonly operation: PathGuardOperation;
} =>
  options?.tool === undefined
    ? { kind, operation }
    : { kind, operation, tool: options.tool };

export const authorizeCanonicalPath = Effect.fnUntraced(function* (
  input: AuthorizeCanonicalPathInput,
) {
  const { canonicalPath, options, pathService, permission, roots, sessionID } =
    input;
  if (roots.some((root) => isInsideRoot(pathService, root, canonicalPath))) {
    return {
      canonicalPath,
      allowedBy: "workspace",
    } satisfies PathGuardAuthorization;
  }

  const { parentDir, pattern } = externalDirectoryPattern(
    pathService,
    canonicalPath,
    options.kind,
  );
  yield* permission.ask({
    sessionID,
    permission: "external_directory",
    capability: options.operation,
    patterns: [pattern],
    always: [pattern],
    metadata: {
      filepath: canonicalPath,
      parentDir,
      operation: options.operation,
    },
    tool: options.tool,
  });
  return {
    canonicalPath,
    allowedBy: "permission",
  } satisfies PathGuardAuthorization;
});
