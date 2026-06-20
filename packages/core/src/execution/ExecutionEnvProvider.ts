import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema, type Scope } from "effect";

import { makeLocalExecutionEnvProvider } from "./localExecutionEnvProvider";

export { makeLocalExecutionEnvProvider };

export interface ExecutionEnvRequest {
  readonly cwd: string;
  readonly roots: ReadonlyArray<string>;
  readonly sessionID: string;
  readonly shellEnv?: Readonly<Record<string, string>>;
  readonly shellPath?: string;
}

export interface ExecutionEnvironment {
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
