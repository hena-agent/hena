import {
  Context,
  Effect,
  type Path as EffectPath,
  type FileSystem,
  Layer,
} from "effect";

import { ExecutionEnvProvider } from "../execution/ExecutionEnvProvider";
import {
  attachHarnessEventBridge,
  makeHarnessEventBridge,
} from "../harness/events";
import { HarnessService } from "../harness/HarnessService";
import { makeHarnessService } from "../harness/makeHarnessService";
import { makeAgentHarnessOptions } from "../harness/options";
import type { HarnessServiceShape } from "../harness/types";
import { collectProjectInstructions } from "../systemPrompt/projectInstructions";
import { AgentHarnessFactory } from "./AgentHarnessFactory";
import { SessionRuntime } from "./SessionRuntimeService";
import { mergeRuntimeSystemPromptConfig } from "./systemPromptConfig";
import type { SessionRuntimeConfig, SessionRuntimeShape } from "./types";

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
): Layer.Layer<
  SessionRuntime | HarnessService,
  unknown,
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
      const options = yield* makeAgentHarnessOptions({
        ...config,
        execution: {
          provider: envProvider,
          request: {
            sessionID: config.sessionID,
            cwd: config.cwd,
            roots: config.roots,
            ...(config.shellEnv === undefined
              ? {}
              : { shellEnv: config.shellEnv }),
            ...(config.shellPath === undefined
              ? {}
              : { shellPath: config.shellPath }),
          },
        },
        ...(systemPrompt === undefined ? {} : { systemPrompt }),
      });
      const harness = yield* factory.create(options);
      yield* attachHarnessEventBridge(harness, bridge);
      const harnessService = yield* makeHarnessService(harness);
      return runtimeContext(
        { sessionID: config.sessionID, events: bridge.stream },
        harnessService,
      );
    }),
  );
