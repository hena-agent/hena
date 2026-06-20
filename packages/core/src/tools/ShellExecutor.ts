import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer } from "effect";

import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import { boundUtf8Text } from "./textBounds";
import { ToolShellError } from "./toolErrors";

interface ShellExecutionResult {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
}

const maxShellOutputBytes = 1024 * 1024;

interface BoundedOutput {
  readonly output: string;
  readonly truncated: boolean;
}

const boundedOutput = (output: string): BoundedOutput => {
  const bounded = boundUtf8Text(output, maxShellOutputBytes);
  return { output: bounded.text, truncated: bounded.truncated };
};

export interface ShellExecutorShape {
  readonly execute: (
    command: string,
    cwd: string,
    signal?: AbortSignal,
  ) => Effect.Effect<ShellExecutionResult, ToolShellError>;
}

const shellError = (error: PiAgent.ExecutionError): ToolShellError =>
  new ToolShellError({ code: error.code, message: error.message });

const rejectedShellError = (): ToolShellError =>
  new ToolShellError({ code: "unknown", message: "Shell execution failed" });

const makeShellExecutor = Effect.fnUntraced(function* () {
  const environment = yield* ExecutionEnvironmentService;
  return {
    execute: Effect.fnUntraced(function* (
      commandText: string,
      cwd: string,
      signal?: AbortSignal,
    ) {
      const result = yield* Effect.tryPromise({
        // oxlint-disable-next-line typescript/promise-function-async
        try: () =>
          environment.env.exec(
            commandText,
            signal === undefined ? { cwd } : { cwd, abortSignal: signal },
          ),
        catch: rejectedShellError,
      });
      if (!result.ok) {
        return yield* Effect.fail(shellError(result.error));
      }
      const output = boundedOutput(
        `${result.value.stdout}${result.value.stderr}`,
      );
      return {
        output: output.output,
        exitCode: result.value.exitCode,
        truncated: output.truncated,
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
