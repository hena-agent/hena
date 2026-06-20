import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect } from "effect";

import {
  boundedShellOutput,
  type ShellOutputCapture,
} from "./shellOutputCapture";
import { ToolShellError } from "./toolErrors";

export interface ShellExecutionResult {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
}

type ExecutionResult = Awaited<ReturnType<PiAgent.ExecutionEnv["exec"]>>;

const shellError = (error: PiAgent.ExecutionError): ToolShellError =>
  new ToolShellError({ code: error.code, message: error.message });

const unboundedShellError = (): ToolShellError =>
  new ToolShellError({
    code: "shell_unavailable",
    message: "Shell execution environment did not stream output",
  });

const abortedTruncatedResult = (
  capture: ShellOutputCapture,
): ShellExecutionResult => ({
  output: capture.output,
  exitCode: 1,
  truncated: true,
});

export const resolveShellExecutionResult = (
  capture: ShellOutputCapture,
  result: ExecutionResult,
): Effect.Effect<ShellExecutionResult, ToolShellError> => {
  if (!result.ok) {
    return capture.truncated && result.error.code === "aborted"
      ? Effect.succeed(abortedTruncatedResult(capture))
      : Effect.fail(shellError(result.error));
  }
  const fallbackOutput = `${result.value.stdout}${result.value.stderr}`;
  if (
    fallbackOutput.length > 0 &&
    capture.output.length === 0 &&
    !capture.truncated
  ) {
    return Effect.fail(unboundedShellError());
  }
  const output =
    capture.output.length > 0 || capture.truncated
      ? capture
      : boundedShellOutput(fallbackOutput);
  return Effect.succeed({
    output: output.output,
    exitCode: result.value.exitCode,
    truncated: output.truncated,
  });
};
