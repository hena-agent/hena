import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, FileSystem, Layer, Schema } from "effect";

import { PathGuard } from "../path/PathGuard";
import { editContent } from "./editOperations";
import {
  type CoreAgentTool,
  type ToolInvocationContext,
  toolReferenceFromContext,
} from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";

const EditToolParameters = Schema.Struct({
  filePath: Schema.String.annotate({
    description: "The absolute path to the file to edit",
  }),
  oldString: Schema.String.annotate({
    description: "The exact string to replace",
  }),
  newString: Schema.String.annotate({
    description: "The replacement string",
  }),
});

type EditToolParameters = (typeof EditToolParameters)["Type"];

export interface EditToolDetails {
  readonly path: string;
  readonly replacements: number;
  readonly bytes: number;
}

export type EditToolShape = ToolShape<EditToolParameters, EditToolDetails>;

const encoder = new TextEncoder();

const makeEditTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathGuard = yield* PathGuard;
  return {
    execute: Effect.fnUntraced(function* (
      params: EditToolParameters,
      context?: ToolInvocationContext<EditToolDetails>,
    ) {
      const tool = toolReferenceFromContext(context);
      const authorization = yield* pathGuard.authorize(
        params.filePath,
        tool === undefined ? undefined : { tool },
      );
      const current = yield* fs.readFileString(authorization.canonicalPath);
      const edit = yield* editContent(
        current,
        params.oldString,
        params.newString,
      );
      yield* fs.writeFileString(authorization.canonicalPath, edit.content);
      return {
        content: [{ type: "text", text: "Edited file successfully." }],
        details: {
          path: authorization.canonicalPath,
          replacements: edit.replacements,
          bytes: encoder.encode(edit.content).length,
        },
      } satisfies PiAgent.AgentToolResult<EditToolDetails>;
    }),
  } satisfies EditToolShape;
});

export class EditTool extends Context.Service<EditTool, EditToolShape>()(
  "@hena-dev/core/EditTool",
) {
  static Live: Layer.Layer<EditTool, never, FileSystem.FileSystem | PathGuard> =
    Layer.effect(EditTool)(makeEditTool());
}

export const makeEditAgentTool = (
  context: Context.Context<EditTool>,
): CoreAgentTool<EditToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: EditTool,
    label: "Edit",
    name: "edit",
    description: "Replace an exact string in a file",
    parameters: EditToolParameters,
  });
