import { Effect, Ref } from "effect";
import {
  type AiError,
  Prompt as AiPrompt,
  type Response,
} from "effect/unstable/ai";

import type { AskService } from "../ask/ask";
import { makeAskService } from "../ask/ask";
import type { EventBus } from "../event/event";
import { makeEventBus } from "../event/event";
import type {
  InvalidExtensionModule,
  LoadedExtension,
} from "../extension/extension";
import { loadExtension as loadRuntimeExtension } from "../extension/extension";
import type { LoopServices, LoopState } from "../loop/run";
import { runLoop } from "../loop/run";
import type {
  ModelNotRegistered,
  ModelRegistry,
} from "../model/model-registry";
import { makeModelRegistry } from "../model/model-registry";
import type { PermissionRegistry } from "../permission/permission-registry";
import { makePermissionRegistry } from "../permission/permission-registry";
import { makeSnapshot, type RuntimeSnapshot } from "../snapshot/snapshot";
import type { SystemPromptRegistry } from "../system-prompt/system-prompt";
import { makeSystemPromptRegistry } from "../system-prompt/system-prompt";
import type { ToolRegistry } from "../tool/tool-registry";
import { makeToolRegistry } from "../tool/tool-registry";

export interface CoreRuntime {
  readonly ask: AskService;
  readonly events: EventBus;
  readonly loadExtension: (
    path: string,
  ) => Effect.Effect<LoadedExtension, InvalidExtensionModule>;
  readonly models: ModelRegistry;
  readonly permissions: PermissionRegistry;
  readonly run: (
    input: AiPrompt.RawInput,
  ) => Effect.Effect<void, ModelNotRegistered | AiError.AiError>;
  readonly snapshot: Effect.Effect<RuntimeSnapshot>;
  readonly systemPrompt: SystemPromptRegistry;
  readonly tools: ToolRegistry;
}

const makeState = Effect.fnUntraced(function* () {
  return {
    history: yield* Ref.make(AiPrompt.empty),
    parts: yield* Ref.make<ReadonlyArray<Response.AnyPart>>([]),
  } satisfies LoopState;
});

const snapshot = (state: LoopState): Effect.Effect<RuntimeSnapshot> =>
  Effect.gen(function* () {
    return makeSnapshot(
      yield* Ref.get(state.history),
      yield* Ref.get(state.parts),
    );
  });

export const makeRuntime = Effect.gen(function* () {
  const events = yield* makeEventBus();
  const ask = yield* makeAskService(events);
  const extensionRevision = yield* Ref.make(0);
  const models = yield* makeModelRegistry();
  const permissions = yield* makePermissionRegistry();
  const state = yield* makeState();
  const systemPrompt = yield* makeSystemPromptRegistry();
  const tools = yield* makeToolRegistry();
  const services = {
    events,
    models,
    permissions,
    state,
    tools,
  } satisfies LoopServices;
  const runtime: CoreRuntime = {
    ask,
    events,
    loadExtension: (path: string) =>
      loadRuntimeExtension(runtime, extensionRevision, path),
    models,
    permissions,
    run: (input: AiPrompt.RawInput) => runLoop(services, input),
    snapshot: snapshot(state),
    systemPrompt,
    tools,
  } satisfies CoreRuntime;

  return runtime;
});
