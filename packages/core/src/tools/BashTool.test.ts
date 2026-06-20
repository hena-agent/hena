import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer, Sink, Stream } from "effect";
import {
  type ChildProcess,
  ChildProcessSpawner,
} from "effect/unstable/process";

import { BashTool, makeBashAgentTool } from "./BashTool";
import { ToolWorkspace } from "./workspace";

const encoder = new TextEncoder();

const makeSpawner = (
  output: string,
  exitCode: number,
  commands: Array<ChildProcess.Command>,
) =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        commands.push(command);
        const stream = Stream.make(encoder.encode(output));
        return ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(1),
          exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          stdin: Sink.drain,
          stdout: stream,
          stderr: Stream.empty,
          all: stream,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          unref: Effect.succeed(Effect.void),
        });
      }),
    ),
  );

it.effect("runs shell commands in the workspace cwd", () => {
  const commands: Array<ChildProcess.Command> = [];

  return Effect.gen(function* () {
    const tool = yield* BashTool;
    const result = yield* tool.execute({ command: "pwd" });

    assert.deepStrictEqual(result.content, [
      { type: "text", text: "/workspace" },
    ]);
    assert.deepStrictEqual(result.details, {
      command: "pwd",
      cwd: "/workspace",
      exitCode: 0,
    });

    const command = commands[0];
    if (command?._tag !== "StandardCommand") {
      throw new Error("expected a standard command");
    }
    assert.strictEqual(command.options.cwd, "/workspace");
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeSpawner("/workspace", 0, commands)),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  );
});

it.effect("returns non-zero shell exits as tool output", () =>
  Effect.gen(function* () {
    const tool = yield* BashTool;
    const result = yield* tool.execute({ command: "exit 1" });

    assert.deepStrictEqual(result.content, [{ type: "text", text: "boom" }]);
    assert.strictEqual(result.details.exitCode, 1);
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeSpawner("boom", 1, [])),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  ),
);

it("adapts BashTool to a pi AgentTool", async () => {
  const tool = makeBashAgentTool(
    Context.make(BashTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "ok" }],
          details: { command: "true", cwd: "/workspace", exitCode: 0 },
        }),
    }),
  );

  const result = await tool.execute("call-1", { command: "true" });

  assert.deepStrictEqual(result.details, {
    command: "true",
    cwd: "/workspace",
    exitCode: 0,
  });
});
