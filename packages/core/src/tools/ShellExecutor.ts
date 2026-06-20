import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer } from "effect";

import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import {
  appendShellCapture,
  boundedShellOutput,
  makeShellAbortController,
  makeShellOutputCapture,
} from "./shellOutputCapture";
import { ToolShellError } from "./toolErrors";

interface ShellExecutionResult {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
}

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
      if (!result.ok) {
        if (capture.truncated && result.error.code === "aborted") {
          return {
            output: capture.output,
            exitCode: 1,
            truncated: true,
          } satisfies ShellExecutionResult;
        }
        return yield* Effect.fail(shellError(result.error));
      }
      const output =
        capture.output.length > 0 || capture.truncated
          ? capture
          : boundedShellOutput(`${result.value.stdout}${result.value.stderr}`);
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
