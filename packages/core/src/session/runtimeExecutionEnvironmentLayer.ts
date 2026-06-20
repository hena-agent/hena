import type { Layer } from "effect";

import {
  type ExecutionEnvironmentService,
  makeExecutionEnvironmentLayer,
} from "../execution/ExecutionEnvironmentService";
import type {
  ExecutionEnvProvider,
  ExecutionEnvProviderError,
  ExecutionEnvRequest,
} from "../execution/ExecutionEnvProvider";
import type { SessionRuntimeConfig } from "./types";

const executionRequest = (
  config: SessionRuntimeConfig,
  sessionID: string,
): ExecutionEnvRequest => ({
  sessionID,
  cwd: config.cwd,
  roots: config.roots,
  ...(config.shellEnv === undefined ? {} : { shellEnv: config.shellEnv }),
  ...(config.shellPath === undefined ? {} : { shellPath: config.shellPath }),
});

export const makeRuntimeExecutionEnvironmentLayer = (
  config: SessionRuntimeConfig,
  sessionID: string,
): Layer.Layer<
  ExecutionEnvironmentService,
  ExecutionEnvProviderError,
  ExecutionEnvProvider
> => makeExecutionEnvironmentLayer(executionRequest(config, sessionID));
