import { Effect, Ref, Stream } from "effect";
import { Prompt, type Response } from "effect/unstable/ai";

import type { EventBus } from "../event/event";
import type { ModelRegistry } from "../model/model-registry";
import type { PermissionRegistry } from "../permission/permission-registry";
import type { ToolRegistry } from "../tool/tool-registry";
import { executeTool } from "./execute-tool";
import { makeToolkit } from "./toolkit";

export interface LoopState {
  readonly history: Ref.Ref<Prompt.Prompt>;
  readonly parts: Ref.Ref<ReadonlyArray<Response.AnyPart>>;
}

export interface LoopServices {
  readonly events: EventBus;
  readonly models: ModelRegistry;
  readonly permissions: PermissionRegistry;
  readonly state: LoopState;
  readonly tools: ToolRegistry;
}

const isToolCall = (
  part: Response.AnyPart,
): part is Response.ToolCallPart<string, unknown> => part.type === "tool-call";

const appendParts = (
  state: LoopState,
  parts: ReadonlyArray<Response.AnyPart>,
): Effect.Effect<void> =>
  Effect.all(
    [
      Ref.update(state.history, (history) =>
        Prompt.concat(history, Prompt.fromResponseParts(parts)),
      ),
      Ref.update(state.parts, (items) => [...items, ...parts]),
    ],
    { discard: true },
  );

const runTurn = Effect.fnUntraced(function* (services: LoopServices) {
  const entries = yield* services.tools.entries;
  const model = yield* services.models.active;
  const history = yield* Ref.get(services.state.history);
  const toolkit = makeToolkit(entries);
  const stream = model.streamText({
    disableToolCallResolution: true,
    prompt: history,
    toolkit,
  });
  const chunk = yield* stream.pipe(
    Stream.tap((part) => services.events.publish({ part, type: "part" })),
    Stream.runCollect,
  );
  const parts = Array.from(chunk);
  const toolCalls = parts.filter(isToolCall);
  const results = yield* Effect.forEach(
    toolCalls,
    (call) => executeTool(services.tools, services.permissions, call),
    { concurrency: "unbounded" },
  );
  yield* Effect.forEach(results, (part) =>
    services.events.publish({ part, type: "tool.result" }),
  );
  yield* appendParts(services.state, [...parts, ...results]);
  return toolCalls.length > 0;
});

export const runLoop = Effect.fnUntraced(function* (
  services: LoopServices,
  input: Prompt.RawInput,
) {
  yield* services.events.publish({ type: "run.started" });
  yield* Ref.update(services.state.history, (history) =>
    Prompt.concat(history, Prompt.make(input)),
  );
  let needsContinuation = yield* runTurn(services);
  while (needsContinuation) {
    needsContinuation = yield* runTurn(services);
  }
  yield* services.events.publish({ type: "run.ended" });
});
