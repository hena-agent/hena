import type { Path as EffectPath } from "effect";

import type { PermissionServiceShape } from "../permission/types";
import { authorizeCanonicalPath } from "./authorization";
import type {
  PathGuardAuthorizeOptions,
  PathGuardOperation,
  PathGuardTargetKind,
} from "./PathGuardTypes";

type CanonicalAuthorizeOptions = PathGuardAuthorizeOptions & {
  readonly kind: PathGuardTargetKind;
  readonly operation: PathGuardOperation;
};

export type AuthorizeCanonical = (
  canonicalPath: string,
  options: CanonicalAuthorizeOptions,
) => ReturnType<typeof authorizeCanonicalPath>;

interface MakeAuthorizeCanonicalInput {
  readonly pathService: EffectPath.Path;
  readonly permission: PermissionServiceShape;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
}

export const makeAuthorizeCanonical =
  (input: MakeAuthorizeCanonicalInput): AuthorizeCanonical =>
  (
    canonicalPath: string,
    options: CanonicalAuthorizeOptions,
  ): ReturnType<typeof authorizeCanonicalPath> =>
    authorizeCanonicalPath({
      canonicalPath,
      options,
      pathService: input.pathService,
      permission: input.permission,
      roots: input.roots,
      sessionID: input.sessionID,
    });
