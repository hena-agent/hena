import type { Effect } from "effect";
import type { PlatformError } from "effect/PlatformError";

import type { PermissionDeniedError } from "../permission/schema";
import type { ToolRef as ToolRefType } from "../toolRef";

export type PathGuardTargetKind = "file" | "directory";

export interface PathGuardAuthorizeOptions {
  readonly kind?: PathGuardTargetKind;
  readonly tool?: ToolRefType | undefined;
}

export type PathGuardError = PermissionDeniedError | PlatformError;

export interface PathGuardAuthorization {
  readonly allowedBy: "workspace" | "permission";
  readonly canonicalPath: string;
}

export interface PathGuardExistingPathAuthorization
  extends PathGuardAuthorization {
  readonly kind: PathGuardTargetKind;
}

export interface PathGuardConfig {
  readonly canonicalize: (path: string) => Effect.Effect<string, PlatformError>;
  readonly getTargetKind?: (
    canonicalPath: string,
  ) => Effect.Effect<PathGuardTargetKind, PlatformError>;
  readonly pathExists: (path: string) => Effect.Effect<boolean, PlatformError>;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
}

export interface PathGuardShape {
  readonly authorize: (
    path: string,
    options?: PathGuardAuthorizeOptions,
  ) => Effect.Effect<PathGuardAuthorization, PathGuardError>;
  readonly authorizeCreateFile: (
    path: string,
    options?: Omit<PathGuardAuthorizeOptions, "kind">,
  ) => Effect.Effect<PathGuardAuthorization, PathGuardError>;
  readonly authorizeExistingPath: (
    path: string,
    options?: Omit<PathGuardAuthorizeOptions, "kind">,
  ) => Effect.Effect<PathGuardExistingPathAuthorization, PathGuardError>;
}
