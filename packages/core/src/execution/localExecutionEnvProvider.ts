import * as PiNode from "@earendil-works/pi-agent-core/node";
import { Effect } from "effect";

import type {
  ExecutionEnvironment,
  ExecutionEnvProviderShape,
  ExecutionEnvRequest,
} from "./ExecutionEnvProvider";

type ManagedExecutionEnvironment = ExecutionEnvironment & {
  readonly cleanup: Effect.Effect<void>;
};

const localEnvironment = (
  request: ExecutionEnvRequest,
): ManagedExecutionEnvironment => {
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

const publicEnvironment = (
  environment: ManagedExecutionEnvironment,
): ExecutionEnvironment => ({
  cwd: environment.cwd,
  env: environment.env,
  roots: [...environment.roots],
});

export const makeLocalExecutionEnvProvider = (): ExecutionEnvProviderShape => ({
  create: (
    request: ExecutionEnvRequest,
  ): ReturnType<ExecutionEnvProviderShape["create"]> =>
    Effect.acquireRelease(
      Effect.sync(() => localEnvironment(request)),
      (environment) => environment.cleanup,
    ).pipe(Effect.map(publicEnvironment)),
});
