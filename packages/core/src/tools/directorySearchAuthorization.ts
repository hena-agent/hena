import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import { isInsideRoot } from "../path/helpers";
import type { PathGuardShape } from "../path/PathGuardTypes";
import type { ToolRef } from "../toolRef";
import type {
  FileSearchAuthorize,
  FileSearchTargetKind,
} from "./fileSearchTypes";

interface MakeDirectorySearchAuthorizeInput {
  readonly fs: FileSystem.FileSystem;
  readonly pathGuard: PathGuardShape;
  readonly pathService: EffectPath.Path;
  readonly root: string;
  readonly rootKind: FileSearchTargetKind;
  readonly tool?: ToolRef | undefined;
}

const authorizeOptions = (
  kind: FileSearchTargetKind,
  tool: ToolRef | undefined,
): Parameters<PathGuardShape["authorize"]>[1] =>
  tool === undefined ? { kind } : { kind, tool };

export const makeDirectorySearchAuthorize = (
  input: MakeDirectorySearchAuthorizeInput,
): FileSearchAuthorize => {
  const authorizedDirectories = new Set(
    input.rootKind === "directory" ? [input.root] : [],
  );
  const authorizedFiles = new Set(
    input.rootKind === "file" ? [input.root] : [],
  );
  const isAuthorized = (path: string): boolean =>
    authorizedFiles.has(path) ||
    Array.from(authorizedDirectories).some((root) =>
      isInsideRoot(input.pathService, root, path),
    );

  return Effect.fnUntraced(function* (path, kind) {
    const canonicalPath = yield* input.fs.realPath(path);
    if (isAuthorized(canonicalPath)) {
      return { canonicalPath };
    }

    const authorization = yield* input.pathGuard.authorize(
      canonicalPath,
      authorizeOptions(kind, input.tool),
    );
    if (kind === "directory") {
      authorizedDirectories.add(authorization.canonicalPath);
    } else {
      authorizedFiles.add(authorization.canonicalPath);
    }
    return { canonicalPath: authorization.canonicalPath };
  });
};
