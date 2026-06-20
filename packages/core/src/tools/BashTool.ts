import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import type { CoreAgentTool } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolWorkspace } from "./workspace";

export const BashToolParameters = Schema.Struct({
  command: Schema.String.annotate({ description: "The shell command to run" }),
});

export type BashToolParameters = (typeof BashToolParameters)["Type"];

export interface BashToolDetails {
  readonly command: string;
  readonly cwd: string;
  readonly exitCode: number;
}

export type BashToolShape = ToolShape<BashToolParameters, BashToolDetails>;

const collectOutput = (
  handle: ChildProcessSpawner.ChildProcessHandle,
): Effect.Effect<string, unknown> =>
  handle.all.pipe(Stream.decodeText(), Stream.mkString);

const makeBashTool = Effect.fnUntraced(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const workspace = yield* ToolWorkspace;
  return {
    execute: Effect.fnUntraced(function* (params: BashToolParameters) {
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const command = ChildProcess.make("sh", ["-c", params.command], {
            cwd: workspace.cwd,
          });
          const handle = yield* spawner.spawn(command);
          const output = yield* collectOutput(handle);
          const exitCode = Number(yield* handle.exitCode);
          if (exitCode !== 0) {
            return yield* Effect.fail(new Error(output));
          }
          return {
            content: [{ type: "text", text: output }],
            details: { command: params.command, cwd: workspace.cwd, exitCode },
          } satisfies PiAgent.AgentToolResult<BashToolDetails>;
        }),
      );
    }),
  } satisfies BashToolShape;
});

export class BashTool extends Context.Service<BashTool, BashToolShape>()(
  "@hena-dev/core/BashTool",
) {
  static Live: Layer.Layer<
    BashTool,
    never,
    ChildProcessSpawner.ChildProcessSpawner | ToolWorkspace
  > = Layer.effect(BashTool)(makeBashTool());
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
