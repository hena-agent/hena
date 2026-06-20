import {
  Effect,
  type Path as EffectPath,
  type FileSystem,
  Layer,
} from "effect";
import type { PlatformError } from "effect/PlatformError";

import {
  type ExecutionEnvProvider,
  type ExecutionEnvProviderError,
  withPrimaryRoot,
} from "../execution/ExecutionEnvProvider";
import type { HarnessService } from "../harness/HarnessService";
import type { PathGuard } from "../path/PathGuard";
import type { PermissionService } from "../permission/PermissionService";
import { QuestionService } from "../question/QuestionService";
import { ToolWorkspace } from "../tools/workspace";
import type { AgentHarnessFactory } from "./AgentHarnessFactory";
import { makeRuntimeHarnessLayer } from "./runtimeHarnessLayer";
import { makeRuntimePathGuardLayer } from "./runtimePathGuardLayer";
import type { SessionRuntime } from "./SessionRuntimeService";
import { getSessionID, type SessionMetadataError } from "./sessionID";
import type { AgentHarnessFactoryError, SessionRuntimeConfig } from "./types";

const normalizeRuntimeRoots = (
  config: SessionRuntimeConfig,
): SessionRuntimeConfig => ({
  ...config,
  roots: withPrimaryRoot(config.cwd, config.roots),
});

export const makeSessionRuntimeLayer = (
  config: SessionRuntimeConfig,
): Layer.Layer<
  | SessionRuntime
  | HarnessService
  | PermissionService
  | QuestionService
  | PathGuard
  | ToolWorkspace,
  | AgentHarnessFactoryError
  | ExecutionEnvProviderError
  | PlatformError
  | SessionMetadataError,
  | AgentHarnessFactory
  | ExecutionEnvProvider
  | FileSystem.FileSystem
  | EffectPath.Path
> =>
  Layer.unwrap(
    Effect.gen(function* () {
      const sessionID = yield* getSessionID(config.session);
      const runtimeConfig = normalizeRuntimeRoots(config);
      return Layer.mergeAll(
        makeRuntimeHarnessLayer(runtimeConfig, sessionID),
        QuestionService.Live,
        makeRuntimePathGuardLayer(runtimeConfig, sessionID),
        ToolWorkspace.layer({ cwd: runtimeConfig.cwd }),
      );
    }),
  );
