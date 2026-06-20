import {
  Context,
  Effect,
  type Path as EffectPath,
  type FileSystem,
  Layer,
} from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import {
  type ExecutionEnvironment,
  ExecutionEnvProvider,
  type ExecutionEnvProviderError,
} from "../execution/ExecutionEnvProvider";
import { attachHarnessEventBridge } from "../harness/attachEvents";
import { makeHarnessEventBridge } from "../harness/events";
import { HarnessService } from "../harness/HarnessService";
import { makeHarnessService } from "../harness/makeHarnessService";
import { makeAgentHarnessOptionsFromEnvironment } from "../harness/options";
import type { HarnessServiceShape } from "../harness/types";
import { collectProjectInstructions } from "../systemPrompt/projectInstructions";
import { AgentHarnessFactory } from "./AgentHarnessFactory";
import { SessionRuntime } from "./SessionRuntimeService";
import { mergeRuntimeSystemPromptConfig } from "./systemPromptConfig";
import type {
  AgentHarnessFactoryError,
  SessionRuntimeConfig,
  SessionRuntimeShape,
} from "./types";

const runtimeContext = (
  service: SessionRuntimeShape,
  harness: HarnessServiceShape,
  environment: ExecutionEnvironment,
): Context.Context<
  SessionRuntime | HarnessService | ExecutionEnvironmentService
> =>
  Context.empty().pipe(
    Context.add(SessionRuntime, service),
    Context.add(HarnessService, harness),
    Context.add(ExecutionEnvironmentService, environment),
  );

export const makeRuntimeHarnessLayer = (
  config: SessionRuntimeConfig,
  sessionID: string,
): Layer.Layer<
  SessionRuntime | HarnessService | ExecutionEnvironmentService,
  AgentHarnessFactoryError | ExecutionEnvProviderError | PlatformError,
  | AgentHarnessFactory
  | ExecutionEnvProvider
  | FileSystem.FileSystem
  | EffectPath.Path
> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const envProvider = yield* ExecutionEnvProvider;
      const factory = yield* AgentHarnessFactory;
      const bridge = yield* makeHarnessEventBridge();
      const projectInstructions = yield* collectProjectInstructions(config);
      const systemPrompt = mergeRuntimeSystemPromptConfig(
        config.systemPrompt,
        projectInstructions,
      );
      const request = {
        sessionID,
        cwd: config.cwd,
        roots: config.roots,
        ...(config.shellEnv === undefined ? {} : { shellEnv: config.shellEnv }),
        ...(config.shellPath === undefined
          ? {}
          : { shellPath: config.shellPath }),
      };
      const environment = yield* envProvider.create(request);
      yield* Effect.addFinalizer(() => environment.cleanup);
      const options = makeAgentHarnessOptionsFromEnvironment({
        ...config,
        environment,
        ...(systemPrompt === undefined ? {} : { systemPrompt }),
      });
      const harness = yield* factory.create(options);
      yield* attachHarnessEventBridge(harness, bridge);
      const harnessService = yield* makeHarnessService(harness);
      return runtimeContext(
        { sessionID, events: bridge.stream },
        harnessService,
        environment,
      );
    }),
  );
