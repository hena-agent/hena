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
  readonly abortSignal?: AbortSignal;
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
    this.calls.push({
      command,
      ...(options?.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options?.abortSignal === undefined
        ? {}
        : { abortSignal: options.abortSignal }),
    });
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
      truncated: false,
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
    assert.strictEqual(result.details.truncated, false);
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironment("boom", 1, [])),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  ),
);

it.effect("truncates oversized shell output", () => {
  const output = "x".repeat(1024 * 1024 + 1);
  return Effect.gen(function* () {
    const tool = yield* BashTool;
    const result = yield* tool.execute({ command: "yes" });
    const [content] = result.content;
    if (content?.type !== "text") {
      throw new Error("expected text content");
    }

    assert.strictEqual(content.text.length, 1024 * 1024);
    assert.strictEqual(result.details.truncated, true);
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironment(output, 0, [])),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  );
});

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

it.effect("passes abort signals to the execution environment", () => {
  const calls: Array<ShellCall> = [];
  const controller = new AbortController();

  return Effect.gen(function* () {
    const tool = yield* BashTool;
    yield* tool.execute(
      { command: "sleep 10" },
      {
        toolCallId: "call-1",
        signal: controller.signal,
        update: () => Effect.void,
      },
    );

    assert.strictEqual(calls[0]?.abortSignal, controller.signal);
  }).pipe(
    Effect.provide(BashTool.Live),
    Effect.provide(makeEnvironment("", 0, calls)),
    Effect.provide(Layer.succeed(ToolWorkspace)({ cwd: "/workspace" })),
  );
});

it("adapts BashTool to a pi AgentTool", async () => {
  const tool = makeBashAgentTool(
    Context.make(BashTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "ok" }],
          details: {
            command: "true",
            cwd: "/workspace",
            exitCode: 0,
            truncated: false,
          },
        }),
    }),
  );

  const result = await tool.execute("call-1", { command: "true" });

  assert.deepStrictEqual(result.details, {
    command: "true",
    cwd: "/workspace",
    exitCode: 0,
    truncated: false,
  });
});
