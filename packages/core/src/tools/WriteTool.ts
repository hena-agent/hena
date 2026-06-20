import type * as PiAgent from "@earendil-works/pi-agent-core";
import {
  Context,
  Effect,
  Path as EffectPath,
  FileSystem,
  Layer,
  Schema,
} from "effect";

import { PathGuard } from "../path/PathGuard";
import {
  type CoreAgentTool,
  type ToolInvocationContext,
  toolReferenceFromContext,
} from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { resolvePath, ToolWorkspace } from "./workspace";
import { writeContentBytes } from "./writeBounds";

const WriteToolParameters = Schema.Struct({
  content: Schema.String.annotate({
    description: "The content to write to the file",
  }),
  filePath: Schema.String.annotate({
    description: "The absolute path to the file to write",
  }),
});

type WriteToolParameters = (typeof WriteToolParameters)["Type"];

export interface WriteToolDetails {
  readonly path: string;
  readonly bytes: number;
}

export type WriteToolShape = ToolShape<WriteToolParameters, WriteToolDetails>;

const makeWriteTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* EffectPath.Path;
  const pathGuard = yield* PathGuard;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (
      params: WriteToolParameters,
      context?: ToolInvocationContext<WriteToolDetails>,
    ) {
      const tool = toolReferenceFromContext(context);
      const requested = resolvePath(
        pathService,
        workspace.cwd,
        params.filePath,
      );
      const authorization = yield* pathGuard.authorizeCreateFile(
        requested,
        tool === undefined
          ? { operation: "write" }
          : { operation: "write", tool },
      );
      const bytes = yield* writeContentBytes(params.content);
      yield* fs.writeFileString(authorization.canonicalPath, params.content);
      return {
        content: [{ type: "text", text: "Wrote file successfully." }],
        details: {
          path: authorization.canonicalPath,
          bytes,
        },
      } satisfies PiAgent.AgentToolResult<WriteToolDetails>;
    }),
  } satisfies WriteToolShape;
});

export class WriteTool extends Context.Service<WriteTool, WriteToolShape>()(
  "@hena-dev/core/WriteTool",
) {
  static Live: Layer.Layer<
    WriteTool,
    never,
    FileSystem.FileSystem | EffectPath.Path | PathGuard | ToolWorkspace
  > = Layer.effect(WriteTool)(makeWriteTool());
}

export const makeWriteAgentTool = (
  context: Context.Context<WriteTool>,
): CoreAgentTool<WriteToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: WriteTool,
    label: "Write",
    name: "write",
    description: "Create or overwrite a file",
    parameters: WriteToolParameters,
  });
