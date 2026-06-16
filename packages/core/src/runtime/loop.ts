import { Effect, Option } from "effect";
import type { AiError, LanguageModel, Prompt } from "effect/unstable/ai";

import type { RuntimeContext } from "./context";
import {
  LoopLimitExceeded,
  MissingProvider,
  type ResponsePartError,
} from "./errors";
import { RuntimeEvent } from "./events";
import type { Registry } from "./registry";
import { streamAssistant } from "./stream";
import { runTools } from "./tool-runner";
import { appendEntry } from "./transcript";

type LoopError =
  | AiError.AiError
  | MissingProvider
  | ResponsePartError
  | LoopLimitExceeded;

const maxLoopSteps = 32;

export const runLoop: (
  context: RuntimeContext,
  step: number,
) => Effect.Effect<void, LoopError> = Effect.fnUntraced(
  function* (context, step) {
    if (step > maxLoopSteps) {
      return yield* new LoopLimitExceeded({ maxSteps: maxLoopSteps });
    }
    const toolCalls = yield* runTurn(context, step);
    if (toolCalls.length === 0) {
      return;
    }
    return yield* runLoop(context, step + 1);
  },
);

const runTurn: (
  context: RuntimeContext,
  step: number,
) => Effect.Effect<ReadonlyArray<Prompt.ToolCallPart>, LoopError> =
  Effect.fnUntraced(function* (context, step) {
    const provider = yield* getProvider(context.registry);
    const result = yield* streamAssistant(context, provider, step);

    yield* appendEntry(context.entries, result.message);
    yield* context.events.publish(
      RuntimeEvent.messageEnd(result.message, step),
    );
    yield* runTools(context, result.toolCalls);
    yield* context.events.publish(RuntimeEvent.turnEnd(step));
    return result.toolCalls;
  });

export const getProvider: (
  registry: Registry,
) => Effect.Effect<LanguageModel.Service, MissingProvider> = Effect.fnUntraced(
  function* (registry) {
    const provider = yield* registry.provider();
    if (Option.isNone(provider)) {
      return yield* new MissingProvider();
    }
    return provider.value;
  },
);
