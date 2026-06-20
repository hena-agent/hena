import { Context, Effect, Layer } from "effect";

import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import {
  resolveShellExecutionResult,
  type ShellExecutionResult,
} from "./shellExecutionResult";
import {
  appendShellCapture,
  makeShellAbortController,
  makeShellOutputCapture,
} from "./shellOutputCapture";
import { ToolShellError } from "./toolErrors";

export interface ShellExecutorShape {
  readonly execute: (
    command: string,
    cwd: string,
    signal?: AbortSignal,
  ) => Effect.Effect<ShellExecutionResult, ToolShellError>;
}

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
      const controller = makeShellAbortController(signal);
      const capture = makeShellOutputCapture();
      const captureChunk = (chunk: string): void => {
        appendShellCapture(capture, chunk);
        if (capture.truncated) {
          controller.abort();
        }
      };
      const result = yield* Effect.tryPromise({
        // oxlint-disable-next-line typescript/promise-function-async
        try: () =>
          environment.env.exec(commandText, {
            cwd,
            abortSignal: controller.signal,
            onStderr: captureChunk,
            onStdout: captureChunk,
          }),
        catch: rejectedShellError,
      });
      return yield* resolveShellExecutionResult(capture, result);
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
