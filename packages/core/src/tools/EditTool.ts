import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Path as EffectPath, FileSystem, Layer } from "effect";

import { PathGuard } from "../path/PathGuard";
import { editContent } from "./editOperations";
import {
  type EditToolDetails,
  type EditToolInput,
  EditToolParameters,
} from "./editSchema";
import {
  type CoreAgentTool,
  type ToolInvocationContext,
  toolReferenceFromContext,
} from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolInputError } from "./toolErrors";
import { resolvePath, ToolWorkspace } from "./workspace";

export type EditToolShape = ToolShape<EditToolInput, EditToolDetails>;

const encoder = new TextEncoder();

const makeEditTool = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* EffectPath.Path;
  const pathGuard = yield* PathGuard;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (
      params: EditToolInput,
      context?: ToolInvocationContext<EditToolDetails>,
    ) {
      const tool = toolReferenceFromContext(context);
      const requested = resolvePath(
        pathService,
        workspace.cwd,
        params.filePath,
      );
      const authorization = yield* pathGuard.authorizeExistingPath(requested, {
        ...(tool === undefined ? {} : { tool }),
      });
      if (authorization.kind !== "file") {
        return yield* Effect.fail(
          new ToolInputError({ message: "Path to edit must be a file." }),
        );
      }
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
  static Live: Layer.Layer<
    EditTool,
    never,
    FileSystem.FileSystem | EffectPath.Path | PathGuard | ToolWorkspace
  > = Layer.effect(EditTool)(makeEditTool());
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
