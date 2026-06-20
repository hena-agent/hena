import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import type { PathGuardShape } from "../path/PathGuard";
import type {
  FileSearchAuthorize,
  FileSearchTargetKind,
} from "./fileSearchTypes";
import type { ToolInvocationContext } from "./schema";
import { toolReferenceFromContext } from "./schema";
import { resolvePath, type ToolWorkspaceConfig } from "./workspace";

export interface DirectorySearchParameters {
  readonly path?: string | undefined;
}

export interface DirectorySearchInput<
  Parameters extends DirectorySearchParameters,
  Details,
> {
  readonly context?: ToolInvocationContext<Details> | undefined;
  readonly fs: FileSystem.FileSystem;
  readonly params: Parameters;
  readonly pathGuard: PathGuardShape;
  readonly pathService: EffectPath.Path;
  readonly search: (
    input: DirectorySearchExecutionInput<Parameters>,
  ) => Effect.Effect<PiAgent.AgentToolResult<Details>, unknown>;
  readonly workspace: ToolWorkspaceConfig;
}

export interface DirectorySearchExecutionInput<
  Parameters extends DirectorySearchParameters,
> {
  readonly authorize: FileSearchAuthorize;
  readonly fs: FileSystem.FileSystem;
  readonly params: Parameters;
  readonly pathService: EffectPath.Path;
  readonly root: string;
}

export const executeDirectorySearch = Effect.fnUntraced(function* <
  Parameters extends DirectorySearchParameters,
  Details,
>(input: DirectorySearchInput<Parameters, Details>) {
  const { context, fs, params, pathGuard, pathService, search, workspace } =
    input;
  const requested = resolvePath(pathService, workspace.cwd, params.path);
  const tool = toolReferenceFromContext(context);
  const authorization = yield* pathGuard.authorize(requested, {
    kind: "directory",
    ...(tool === undefined ? {} : { tool }),
  });
  const authorize: FileSearchAuthorize = (
    path: string,
    kind: FileSearchTargetKind,
  ) =>
    pathGuard.authorize(path, {
      kind,
      ...(tool === undefined ? {} : { tool }),
    });
  return yield* search({
    authorize,
    fs,
    pathService,
    root: authorization.canonicalPath,
    params,
  });
});
