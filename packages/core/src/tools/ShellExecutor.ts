import { Context, Effect, Layer, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

interface ShellExecutionResult {
  readonly exitCode: number;
  readonly output: string;
}

export interface ShellExecutorShape {
  readonly execute: (
    command: string,
    cwd: string,
  ) => Effect.Effect<ShellExecutionResult, Error | PlatformError>;
}

const collectOutput = (
  handle: ChildProcessSpawner.ChildProcessHandle,
): Effect.Effect<string, PlatformError> =>
  handle.all.pipe(Stream.decodeText(), Stream.mkString);

const makeShellExecutor = Effect.fnUntraced(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return {
    execute: Effect.fnUntraced(function* (commandText: string, cwd: string) {
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const command = ChildProcess.make("sh", ["-c", commandText], { cwd });
          const handle = yield* spawner.spawn(command);
          const output = yield* collectOutput(handle);
          const exitCode = Number(yield* handle.exitCode);
          if (exitCode !== 0) {
            return yield* Effect.fail(new Error(output));
          }
          return { output, exitCode } satisfies ShellExecutionResult;
        }),
      );
    }),
  } satisfies ShellExecutorShape;
});

export class ShellExecutor extends Context.Service<
  ShellExecutor,
  ShellExecutorShape
>()("@hena-dev/core/ShellExecutor") {
  static Live: Layer.Layer<
    ShellExecutor,
    never,
    ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(ShellExecutor)(makeShellExecutor());
}
