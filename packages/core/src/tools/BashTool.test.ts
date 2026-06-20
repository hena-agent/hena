import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import type { ExecutionEnvironment } from "../execution/ExecutionEnvProvider";
import { BashTool, makeBashAgentTool } from "./BashTool";
import { ToolShellError } from "./toolErrors";
import { ToolWorkspace } from "./workspace";

interface ShellCall {
  readonly command: string;
  readonly cwd?: string;
}

type ShellResult = Awaited<ReturnType<PiAgent.ExecutionEnv["exec"]>>;

class FakeExecutionEnv extends PiNode.NodeExecutionEnv {
  constructor(
    private readonly result: ShellResult | Error,
    private readonly calls: Array<ShellCall>,
  ) {
    super({ cwd: "/workspace" });
  }

  override async exec(
    command: string,
    options?: PiAgent.ExecutionEnvExecOptions,
  ): Promise<ShellResult> {
    await Promise.resolve();
    this.calls.push(
      options?.cwd === undefined ? { command } : { command, cwd: options.cwd },
    );
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

const shellResult = (output: string, exitCode: number): ShellResult =>
  PiAgent.ok({ stdout: output, stderr: "", exitCode });

const shellFailure = (): ShellResult =>
  PiAgent.err(new PiAgent.ExecutionError("spawn_error", "spawn failed"));

const makeEnvironment = (
  output: string,
  exitCode: number,
  calls: Array<ShellCall>,
) => makeEnvironmentWithResult(shellResult(output, exitCode), calls);

const makeEnvironmentWithResult = (
  result: ShellResult | Error,
  calls: Array<ShellCall>,
) => {
  const env = new FakeExecutionEnv(result, calls);
  return Layer.succeed(ExecutionEnvironmentService)({
    cwd: "/workspace",
    roots: ["/workspace"],
    env,
    cleanup: Effect.void,
  } satisfies ExecutionEnvironment);
};

it.effect("runs shell commands in the workspace cwd", () => {
  const calls: Array<ShellCall> = [];

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

    assert.deepStrictEqual(calls, [{ command: "pwd", cwd: "/workspace" }]);
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironment("/workspace", 0, calls)),
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
    Effect.provide(makeEnvironment("boom", 1, [])),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  ),
);

it.effect("maps execution environment shell failures", () =>
  Effect.gen(function* () {
    const tool = yield* BashTool;
    const error = yield* tool.execute({ command: "missing" }).pipe(Effect.flip);

    assert.ok(error instanceof ToolShellError);
    assert.strictEqual(error.code, "spawn_error");
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironmentWithResult(shellFailure(), [])),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  ),
);

it.effect("maps rejected shell executions", () =>
  Effect.gen(function* () {
    const tool = yield* BashTool;
    const error = yield* tool.execute({ command: "explode" }).pipe(Effect.flip);

    assert.ok(error instanceof ToolShellError);
    assert.strictEqual(error.code, "unknown");
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironmentWithResult(new Error("boom"), [])),
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
