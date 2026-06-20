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
import { executeGrepSearch } from "./grepSearch";
import type { CoreAgentTool, ToolInvocationContext } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolWorkspace } from "./workspace";

const GrepToolParameters = Schema.Struct({
  pattern: Schema.String.annotate({
    description: "The regex pattern to search for in file contents",
  }),
  path: Schema.optional(Schema.String).annotate({
    description: "The directory to search in. Defaults to cwd.",
  }),
  include: Schema.optional(Schema.String).annotate({
    description: "File pattern to include in the search",
  }),
});

type GrepToolParameters = (typeof GrepToolParameters)["Type"];

export interface GrepToolDetails {
  readonly matches: number;
  readonly truncated: boolean;
}

export type GrepToolShape = ToolShape<GrepToolParameters, GrepToolDetails>;

const makeGrepTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathGuard = yield* PathGuard;
  const pathService = yield* EffectPath.Path;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (
      params: GrepToolParameters,
      context?: ToolInvocationContext<GrepToolDetails>,
    ) {
      return yield* executeDirectorySearch({
        context,
        fs,
        params,
        pathGuard,
        pathService,
        search: executeGrepSearch,
        workspace,
      });
    }),
  } satisfies GrepToolShape;
});

export class GrepTool extends Context.Service<GrepTool, GrepToolShape>()(
  "@hena-dev/core/GrepTool",
) {
  static Live: Layer.Layer<
    GrepTool,
    never,
    FileSystem.FileSystem | EffectPath.Path | PathGuard | ToolWorkspace
  > = Layer.effect(GrepTool)(makeGrepTool());
}

export const makeGrepAgentTool = (
  context: Context.Context<GrepTool>,
): CoreAgentTool<GrepToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: GrepTool,
    label: "Grep",
    name: "grep",
    description: "Search file contents with a regex",
    parameters: GrepToolParameters,
  });
