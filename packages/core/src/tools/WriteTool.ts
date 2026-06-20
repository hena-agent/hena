import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, FileSystem, Layer, Schema } from "effect";

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

const encoder = new TextEncoder();

const makeWriteTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathGuard = yield* PathGuard;
  return {
    execute: Effect.fnUntraced(function* (
      params: WriteToolParameters,
      context?: ToolInvocationContext<WriteToolDetails>,
    ) {
      const tool = toolReferenceFromContext(context);
      const authorization = yield* pathGuard.authorizeCreateFile(
        params.filePath,
        tool === undefined ? undefined : { tool },
      );
      yield* fs.writeFileString(authorization.canonicalPath, params.content);
      return {
        content: [{ type: "text", text: "Wrote file successfully." }],
        details: {
          path: authorization.canonicalPath,
          bytes: encoder.encode(params.content).length,
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
    FileSystem.FileSystem | PathGuard
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
