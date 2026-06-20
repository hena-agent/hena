import { Context, Effect, Layer } from "effect";

import {
  type ExecutionEnvironment,
  ExecutionEnvProvider,
  type ExecutionEnvProviderError,
  type ExecutionEnvRequest,
} from "./ExecutionEnvProvider";

export class ExecutionEnvironmentService extends Context.Service<
  ExecutionEnvironmentService,
  ExecutionEnvironment
>()("@hena-dev/core/ExecutionEnvironmentService") {}

export const makeExecutionEnvironmentLayer = (
  request: ExecutionEnvRequest,
): Layer.Layer<
  ExecutionEnvironmentService,
  ExecutionEnvProviderError,
  ExecutionEnvProvider
> =>
  Layer.effect(
    ExecutionEnvironmentService,
    Effect.gen(function* () {
      const provider = yield* ExecutionEnvProvider;
      const environment = yield* provider.create(request);
      yield* Effect.addFinalizer(() => environment.cleanup);
      return environment;
    }),
  );
