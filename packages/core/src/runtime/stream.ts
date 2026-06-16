import { Effect, Ref, Stream } from "effect";
import { type AiError, type LanguageModel, Toolkit } from "effect/unstable/ai";

import {
  type AssistantResult,
  applyAssistantPart,
  finishAssistant,
  makeAssistantState,
} from "./assistant";
import type { RuntimeContext } from "./context";
import type { ResponsePartError } from "./errors";
import { RuntimeEvent } from "./events";

export const streamAssistant: (
  context: RuntimeContext,
  provider: LanguageModel.Service,
  step: number,
) => Effect.Effect<AssistantResult, AiError.AiError | ResponsePartError> =
  Effect.fnUntraced(function* (context, provider, step) {
    yield* context.events.publish(RuntimeEvent.turnStart(step));
    yield* context.events.publish(RuntimeEvent.messageStart(step));

    const entries = yield* Ref.get(context.entries);
    const tools = yield* context.registry.tools();
    const toolkit = Toolkit.make(...tools.map((tool) => tool.tool));
    const stream = provider.streamText({
      prompt: entries,
      toolkit,
      disableToolCallResolution: true,
    });
    const assistant = yield* Stream.runFoldEffect(
      stream,
      makeAssistantState,
      (current, part) =>
        Effect.gen(function* () {
          yield* context.events.publish(RuntimeEvent.messageDelta(part, step));
          return yield* applyAssistantPart(current, part);
        }),
    );

    return finishAssistant(assistant);
  });
