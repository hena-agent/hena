import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer } from "effect";

import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import { ToolShellError } from "./toolErrors";

interface ShellExecutionResult {
  readonly exitCode: number;
  readonly output: string;
}

export interface ShellExecutorShape {
  readonly execute: (
    command: string,
    cwd: string,
  ) => Effect.Effect<ShellExecutionResult, ToolShellError>;
}

const shellError = (error: PiAgent.ExecutionError): ToolShellError =>
  new ToolShellError({ code: error.code, message: error.message });

const rejectedShellError = (): ToolShellError =>
  new ToolShellError({ code: "unknown", message: "Shell execution failed" });

const makeShellExecutor = Effect.fnUntraced(function* () {
  const environment = yield* ExecutionEnvironmentService;
  return {
    execute: Effect.fnUntraced(function* (commandText: string, cwd: string) {
      const result = yield* Effect.tryPromise({
        // oxlint-disable-next-line typescript/promise-function-async
        try: () => environment.env.exec(commandText, { cwd }),
        catch: rejectedShellError,
      });
      if (!result.ok) {
        return yield* Effect.fail(shellError(result.error));
      }
      return {
        output: `${result.value.stdout}${result.value.stderr}`,
        exitCode: result.value.exitCode,
      } satisfies ShellExecutionResult;
    }),
  } satisfies ShellExecutorShape;
});

export class ShellExecutor extends Context.Service<
  ShellExecutor,
  ShellExecutorShape
>()("@hena-dev/core/ShellExecutor") {
  static Live: Layer.Layer<ShellExecutor, never, ExecutionEnvironmentService> =
    Layer.effect(ShellExecutor)(makeShellExecutor());
}
