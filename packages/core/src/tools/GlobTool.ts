import {
  Context,
  Effect,
  Path as EffectPath,
  FileSystem,
  Layer,
  Schema,
} from "effect";

import { PathGuard } from "../path/PathGuard";
import { executeDirectorySearch } from "./directorySearchTool";
import { executeGlobSearch } from "./globSearch";
import type { CoreAgentTool, ToolInvocationContext } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolWorkspace } from "./workspace";

const GlobToolParameters = Schema.Struct({
  pattern: Schema.String.annotate({
    description: "The glob pattern to match files against",
  }),
  path: Schema.optional(Schema.String).annotate({
    description:
      "The directory to search in. Defaults to the current working directory.",
  }),
});

type GlobToolParameters = (typeof GlobToolParameters)["Type"];

export interface GlobToolDetails {
  readonly count: number;
  readonly truncated: boolean;
}

export type GlobToolShape = ToolShape<GlobToolParameters, GlobToolDetails>;

const makeGlobTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathGuard = yield* PathGuard;
  const pathService = yield* EffectPath.Path;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (
      params: GlobToolParameters,
      context?: ToolInvocationContext<GlobToolDetails>,
    ) {
      return yield* executeDirectorySearch({
        context,
        fs,
        params,
        pathGuard,
        pathService,
        search: executeGlobSearch,
        workspace,
      });
    }),
  } satisfies GlobToolShape;
});

export class GlobTool extends Context.Service<GlobTool, GlobToolShape>()(
  "@hena-dev/core/GlobTool",
) {
  static Live: Layer.Layer<
    GlobTool,
    never,
    FileSystem.FileSystem | EffectPath.Path | PathGuard | ToolWorkspace
  > = Layer.effect(GlobTool)(makeGlobTool());
}

export const makeGlobAgentTool = (
  context: Context.Context<GlobTool>,
): CoreAgentTool<GlobToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: GlobTool,
    label: "Glob",
    name: "glob",
    description: "Find files by glob pattern",
    parameters: GlobToolParameters,
  });
