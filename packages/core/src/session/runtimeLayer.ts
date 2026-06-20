import { type Path as EffectPath, type FileSystem, Layer } from "effect";

import type { ExecutionEnvProvider } from "../execution/ExecutionEnvProvider";
import type { HarnessService } from "../harness/HarnessService";
import type { PathGuard } from "../path/PathGuard";
import type { PermissionService } from "../permission/PermissionService";
import { QuestionService } from "../question/QuestionService";
import { ToolWorkspace } from "../tools/workspace";
import type { AgentHarnessFactory } from "./AgentHarnessFactory";
import { makeRuntimeHarnessLayer } from "./runtimeHarnessLayer";
import { makeRuntimePathGuardLayer } from "./runtimePathGuardLayer";
import type { SessionRuntime } from "./SessionRuntimeService";
import type { SessionRuntimeConfig } from "./types";

export const makeSessionRuntimeLayer = (
  config: SessionRuntimeConfig,
): Layer.Layer<
  | SessionRuntime
  | HarnessService
  | PermissionService
  | QuestionService
  | PathGuard
  | ToolWorkspace,
  unknown,
  | AgentHarnessFactory
  | ExecutionEnvProvider
  | FileSystem.FileSystem
  | EffectPath.Path
> =>
  Layer.mergeAll(
    makeRuntimeHarnessLayer(config),
    QuestionService.Live,
    makeRuntimePathGuardLayer(config),
    ToolWorkspace.layer({ cwd: config.cwd }),
  );
