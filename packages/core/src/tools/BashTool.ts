import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema } from "effect";

import type { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import { ShellExecutor } from "./ShellExecutor";
import type { CoreAgentTool } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolWorkspace } from "./workspace";

const BashToolParameters = Schema.Struct({
  command: Schema.String.annotate({ description: "The shell command to run" }),
});

type BashToolParameters = (typeof BashToolParameters)["Type"];

export interface BashToolDetails {
  readonly command: string;
  readonly cwd: string;
  readonly exitCode: number;
}

export type BashToolShape = ToolShape<BashToolParameters, BashToolDetails>;

const makeBashTool = Effect.fnUntraced(function* () {
  const shell = yield* ShellExecutor;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (params: BashToolParameters) {
      const result = yield* shell.execute(params.command, workspace.cwd);
      return {
        content: [{ type: "text", text: result.output }],
        details: {
          command: params.command,
          cwd: workspace.cwd,
          exitCode: result.exitCode,
        },
      } satisfies PiAgent.AgentToolResult<BashToolDetails>;
    }),
  } satisfies BashToolShape;
});

export class BashTool extends Context.Service<BashTool, BashToolShape>()(
  "@hena-dev/core/BashTool",
) {
  static Live: Layer.Layer<
    BashTool,
    never,
    ExecutionEnvironmentService | ToolWorkspace
  > = Layer.effect(BashTool)(makeBashTool()).pipe(
    Layer.provideMerge(ShellExecutor.Live),
  );
}

export const makeBashAgentTool = (
  context: Context.Context<BashTool>,
): CoreAgentTool<BashToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: BashTool,
    label: "Bash",
    name: "bash",
    description: "Run a shell command in the workspace cwd",
    parameters: BashToolParameters,
  });
