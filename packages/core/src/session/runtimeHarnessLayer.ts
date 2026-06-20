import {
  Context,
  Effect,
  type Path as EffectPath,
  type FileSystem,
  Layer,
} from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import { attachHarnessEventBridge } from "../harness/attachEvents";
import { makeUnsafeHarnessEventBridge } from "../harness/events";
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
): Context.Context<SessionRuntime | HarnessService> =>
  Context.empty().pipe(
    Context.add(SessionRuntime, service),
    Context.add(HarnessService, harness),
  );

export const makeRuntimeHarnessLayer = (
  config: SessionRuntimeConfig,
  sessionID: string,
): Layer.Layer<
  SessionRuntime | HarnessService,
  AgentHarnessFactoryError | PlatformError,
  | AgentHarnessFactory
  | ExecutionEnvironmentService
  | FileSystem.FileSystem
  | EffectPath.Path
> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const environment = yield* ExecutionEnvironmentService;
      const factory = yield* AgentHarnessFactory;
      const bridge = yield* makeUnsafeHarnessEventBridge();
      const projectInstructions = yield* collectProjectInstructions(config);
      const systemPrompt = mergeRuntimeSystemPromptConfig(
        config.systemPrompt,
        projectInstructions,
      );
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
      );
    }),
  );
