import {
  Context,
  Effect,
  type Path as EffectPath,
  type FileSystem,
  Layer,
} from "effect";
import type { PlatformError } from "effect/PlatformError";

import {
  ExecutionEnvProvider,
  type ExecutionEnvProviderError,
} from "../execution/ExecutionEnvProvider";
import { attachHarnessEventBridge } from "../harness/attachEvents";
import { makeHarnessEventBridge } from "../harness/events";
import { HarnessService } from "../harness/HarnessService";
import { makeHarnessService } from "../harness/makeHarnessService";
import { makeAgentHarnessOptions } from "../harness/options";
import type { HarnessServiceShape } from "../harness/types";
import { collectProjectInstructions } from "../systemPrompt/projectInstructions";
import { AgentHarnessFactory } from "./AgentHarnessFactory";
import { SessionRuntime } from "./SessionRuntimeService";
import { getSessionID, type SessionMetadataError } from "./sessionID";
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
  ExecutionEnvProviderError | PlatformError | SessionMetadataError,
  | AgentHarnessFactory
  | ExecutionEnvProvider
  | FileSystem.FileSystem
  | EffectPath.Path
> =>
  Layer.effectContext(
    Effect.gen(function* () {
      const envProvider = yield* ExecutionEnvProvider;
      const factory = yield* AgentHarnessFactory;
      const sessionID = yield* getSessionID(config.session);
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
            sessionID,
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
        { sessionID, events: bridge.stream },
        harnessService,
      );
    }),
  );
