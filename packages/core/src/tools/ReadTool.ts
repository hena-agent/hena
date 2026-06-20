import {
  Context,
  Effect,
  Path as EffectPath,
  FileSystem,
  Layer,
  Schema,
} from "effect";

import { PathGuard } from "../path/PathGuard";
import type { ReadToolDetails } from "./readDetails";
import { readDirectory, readFile } from "./readOperations";
import {
  type CoreAgentTool,
  type ToolInvocationContext,
  toolReferenceFromContext,
} from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";

const PositiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

export const ReadToolParameters = Schema.Struct({
  filePath: Schema.String.annotate({
    description: "The absolute path to the file or directory to read",
  }),
  offset: Schema.optional(PositiveInt).annotate({
    description: "The line number to start reading from (1-indexed)",
  }),
  limit: Schema.optional(PositiveInt).annotate({
    description: "The maximum number of lines to read (defaults to 2000)",
  }),
});

export type ReadToolParameters = (typeof ReadToolParameters)["Type"];
export type { ReadToolDetails } from "./readDetails";

export type ReadToolShape = ToolShape<ReadToolParameters, ReadToolDetails>;

const makeReadTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* EffectPath.Path;
  const pathGuard = yield* PathGuard;
  return {
    execute: Effect.fnUntraced(function* (
      params: ReadToolParameters,
      context?: ToolInvocationContext<ReadToolDetails>,
    ) {
      const tool = toolReferenceFromContext(context);
      const info = yield* fs.stat(params.filePath);
      const authorization = yield* pathGuard.authorize(params.filePath, {
        kind: info.type === "Directory" ? "directory" : "file",
        ...(tool === undefined ? {} : { tool }),
      });
      if (info.type === "Directory") {
        return yield* readDirectory(
          fs,
          pathService,
          authorization.canonicalPath,
        );
      }
      return yield* readFile(fs, authorization.canonicalPath, params);
    }),
  } satisfies ReadToolShape;
});

export class ReadTool extends Context.Service<ReadTool, ReadToolShape>()(
  "@hena-dev/core/ReadTool",
) {
  static Live: Layer.Layer<
    ReadTool,
    never,
    FileSystem.FileSystem | EffectPath.Path | PathGuard
  > = Layer.effect(ReadTool)(makeReadTool());
}

export const makeReadAgentTool = (
  context: Context.Context<ReadTool>,
): CoreAgentTool<ReadToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: ReadTool,
    label: "Read",
    name: "read",
    description: "Read a file or directory",
    parameters: ReadToolParameters,
  });
