import { Effect, type Path as EffectPath } from "effect";

import type { PermissionServiceShape } from "../permission/types";
import { externalDirectoryPattern, isInsideRoot } from "./helpers";
import type {
  PathGuardAuthorization,
  PathGuardAuthorizeOptions,
  PathGuardTargetKind,
} from "./PathGuardTypes";

interface AuthorizeCanonicalPathInput {
  readonly canonicalPath: string;
  readonly options: PathGuardAuthorizeOptions & {
    readonly kind: PathGuardTargetKind;
  };
  readonly pathService: EffectPath.Path;
  readonly permission: PermissionServiceShape;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
}

export const withPathGuardTool = (
  kind: PathGuardTargetKind,
  options?: Omit<PathGuardAuthorizeOptions, "kind">,
): PathGuardAuthorizeOptions & { readonly kind: PathGuardTargetKind } =>
  options?.tool === undefined ? { kind } : { kind, tool: options.tool };

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
    patterns: [pattern],
    always: [pattern],
    metadata: { filepath: canonicalPath, parentDir },
    tool: options.tool,
  });
  return {
    canonicalPath,
    allowedBy: "permission",
  } satisfies PathGuardAuthorization;
});
