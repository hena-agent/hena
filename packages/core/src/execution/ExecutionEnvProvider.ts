import type * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import { Context, Effect, Layer, Schema, type Scope } from "effect";

export interface ExecutionEnvRequest {
  readonly cwd: string;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
  readonly shellEnv?: Readonly<Record<string, string>>;
  readonly shellPath?: string;
}

export interface ExecutionEnvironment {
  readonly cleanup: Effect.Effect<void>;
  readonly cwd: string;
  readonly env: PiAgent.ExecutionEnv;
  readonly roots: ReadonlyArray<string>;
}

type ExecutionEnvAcquire = Effect.Effect<
  ExecutionEnvironment,
  ExecutionEnvProviderError,
  Scope.Scope
>;

export interface ExecutionEnvProviderShape {
  readonly create: (request: ExecutionEnvRequest) => ExecutionEnvAcquire;
}

export class ExecutionEnvProviderError extends Schema.TaggedErrorClass<ExecutionEnvProviderError>()(
  "ExecutionEnvProviderError",
  {
    code: Schema.Literal("cloud_sandbox_unavailable"),
    message: Schema.String,
  },
) {}

export const withPrimaryRoot = (
  cwd: string,
  roots: ReadonlyArray<string>,
): ReadonlyArray<string> =>
  roots.includes(cwd) ? [...roots] : [cwd, ...roots];

const localEnvironment = (
  request: ExecutionEnvRequest,
): ExecutionEnvironment => {
  const env = new PiNode.NodeExecutionEnv({
    cwd: request.cwd,
    ...(request.shellEnv === undefined
      ? {}
      : { shellEnv: { ...request.shellEnv } }),
    ...(request.shellPath === undefined
      ? {}
      : { shellPath: request.shellPath }),
  });

  return {
    cwd: request.cwd,
    env,
    roots: [...request.roots],
    // oxlint-disable-next-line typescript/promise-function-async
    cleanup: Effect.promise(() => env.cleanup()).pipe(Effect.ignore),
  };
};

export const makeLocalExecutionEnvProvider = (): ExecutionEnvProviderShape => ({
  create: (request: ExecutionEnvRequest): ExecutionEnvAcquire =>
    Effect.acquireRelease(
      Effect.sync(() => localEnvironment(request)),
      (environment) => environment.cleanup,
    ),
});

export const makeCloudExecutionEnvProvider = (): ExecutionEnvProviderShape => ({
  create: (): Effect.Effect<ExecutionEnvironment, ExecutionEnvProviderError> =>
    Effect.fail(
      new ExecutionEnvProviderError({
        code: "cloud_sandbox_unavailable",
        message: "Cloud sandbox execution environments are not implemented yet",
      }),
    ),
});

export class ExecutionEnvProvider extends Context.Service<
  ExecutionEnvProvider,
  ExecutionEnvProviderShape
>()("@hena-dev/core/ExecutionEnvProvider") {
  static readonly Local: Layer.Layer<ExecutionEnvProvider> = Layer.succeed(
    this,
    makeLocalExecutionEnvProvider(),
  );

  static readonly CloudStub: Layer.Layer<ExecutionEnvProvider> = Layer.succeed(
    this,
    makeCloudExecutionEnvProvider(),
  );
}
