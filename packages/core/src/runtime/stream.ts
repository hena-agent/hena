import { Effect, Ref, Stream } from "effect";
import {
  type AiError,
  type LanguageModel,
  type Prompt,
  type Response,
  type Tool,
  Toolkit,
} from "effect/unstable/ai";

import type { Entry } from "./entry";
import type { EventLog } from "./events";
import type { Registry } from "./registry";

interface StreamContext {
  readonly entries: Ref.Ref<ReadonlyArray<Entry>>;
  readonly events: EventLog;
  readonly registry: Registry;
}

export const streamAssistant = (
  context: StreamContext,
  provider: LanguageModel.Service,
  step: number,
): Effect.Effect<
  ReadonlyArray<Response.StreamPart<Record<string, Tool.Any>>>,
  AiError.AiError
> =>
  Effect.gen(function* () {
    yield* context.events.publish({ type: "turn_start", step });
    yield* context.events.publish({ type: "message_start", step });

    const entries = yield* Ref.get(context.entries);
    const tools = yield* context.registry.tools();
    const toolkit = Toolkit.make(...tools.map((tool) => tool.tool));
    const stream = provider.streamText({
      prompt: entries.filter(isPromptMessage),
      toolkit,
      disableToolCallResolution: true,
    });
    const parts = Array.from(yield* Stream.runCollect(stream));

    yield* Effect.forEach(
      parts,
      (part) => context.events.publish({ type: "message_delta", part, step }),
      { discard: true },
    );
    return parts;
  });

const isPromptMessage = (entry: Entry): entry is Prompt.Message =>
  "role" in entry;
