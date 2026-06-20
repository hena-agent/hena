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

  return Effect.fnUntraced(function* (path) {
    const canonicalPath = yield* input.fs.realPath(path);
    if (isAuthorized(canonicalPath)) {
      return { canonicalPath };
    }

    const authorization = yield* input.pathGuard.authorizeExistingPath(
      canonicalPath,
      input.tool === undefined
        ? { operation: "search" }
        : { operation: "search", tool: input.tool },
    );
    if (authorization.kind === "directory") {
      authorizedDirectories.add(authorization.canonicalPath);
    } else {
      authorizedFiles.add(authorization.canonicalPath);
    }
    return { canonicalPath: authorization.canonicalPath };
  });
};
