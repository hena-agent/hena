import { Effect, type Ref } from "effect";
import type { AiError, LanguageModel, Prompt } from "effect/unstable/ai";

import { collectAssistant } from "./assistant";
import type { Entry } from "./entry";
import { MissingProvider } from "./errors";
import type { EventLog } from "./events";
import type { Registry } from "./registry";
import { streamAssistant } from "./stream";
import { runTool } from "./tool-runner";
import { appendEntry } from "./transcript";

interface LoopContext {
  readonly entries: Ref.Ref<ReadonlyArray<Entry>>;
  readonly events: EventLog;
  readonly registry: Registry;
}

export const runLoop = (
  context: LoopContext,
  step: number,
): Effect.Effect<void, AiError.AiError | MissingProvider> =>
  Effect.gen(function* () {
    const toolCalls = yield* runTurn(context, step);
    if (toolCalls.length === 0) {
      return;
    }
    return yield* runLoop(context, step + 1);
  });

const runTurn = (
  context: LoopContext,
  step: number,
): Effect.Effect<
  ReadonlyArray<Prompt.ToolCallPart>,
  AiError.AiError | MissingProvider
> =>
  Effect.gen(function* () {
    const provider = yield* getProvider(context.registry);
    const parts = yield* streamAssistant(context, provider, step);
    const result = collectAssistant(parts);

    yield* appendEntry(context.entries, result.message);
    yield* context.events.publish({
      type: "message_end",
      entry: result.message,
    });
    yield* Effect.forEach(result.toolCalls, (call) => runTool(context, call), {
      concurrency: "unbounded",
      discard: true,
    });
    yield* context.events.publish({
      type: "turn_end",
      step,
    });
    return result.toolCalls;
  });

const getProvider = (
  registry: Registry,
): Effect.Effect<LanguageModel.Service, MissingProvider> =>
  Effect.gen(function* () {
    const provider = yield* registry.provider();
    if (provider._tag === "Empty") {
      return yield* new MissingProvider();
    }
    return provider.provider;
  });
