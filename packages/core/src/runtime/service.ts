import { Effect, Ref, type Schema, type Stream } from "effect";
import type { AiError, LanguageModel, Prompt } from "effect/unstable/ai";

import type { Entry } from "./entry";
import type { MissingProvider } from "./errors";
import type { RuntimeEvent } from "./events";
import { makeEventLog } from "./events";
import { runLoop } from "./loop";
import { makeRegistry } from "./registry";
import { makeRegisteredTool, type RuntimeTool, type ToolHandler } from "./tool";
import { appendEntry } from "./transcript";

export interface Runtime {
  readonly registerProvider: (
    provider: LanguageModel.Service,
  ) => Effect.Effect<void>;
  readonly registerTool: <
    const Name extends string,
    Parameters extends Schema.Decoder<unknown>,
    Success extends Schema.Schema<unknown>,
    E,
  >(
    tool: RuntimeTool<Name, Parameters, Success>,
    execute: ToolHandler<Parameters, Success, E>,
  ) => Effect.Effect<void>;
  readonly prompt: (
    message: Prompt.Message,
  ) => Effect.Effect<void, AiError.AiError | MissingProvider>;
  readonly history: () => Effect.Effect<ReadonlyArray<Entry>>;
  readonly events: () => Effect.Effect<ReadonlyArray<RuntimeEvent>>;
  readonly subscribe: () => Stream.Stream<RuntimeEvent>;
}

const makeRuntime: () => Effect.Effect<Runtime> = Effect.fnUntraced(
  function* () {
    const entries = yield* Ref.make<ReadonlyArray<Entry>>([]);
    const events = yield* makeEventLog;
    const registry = yield* makeRegistry;
    const registerTool = <
      const Name extends string,
      Parameters extends Schema.Decoder<unknown>,
      Success extends Schema.Schema<unknown>,
      E,
    >(
      tool: RuntimeTool<Name, Parameters, Success>,
      execute: ToolHandler<Parameters, Success, E>,
    ): Effect.Effect<void> =>
      registry.registerTool(makeRegisteredTool(tool, execute));
    const prompt = (
      message: Prompt.Message,
    ): Effect.Effect<void, AiError.AiError | MissingProvider> =>
      Effect.gen(function* () {
        yield* events.publish({ type: "session_start" });
        yield* appendEntry(entries, message);
        yield* runLoop({ entries, events, registry }, 1);
        yield* events.publish({ type: "idle" });
      });

    return {
      registerProvider: registry.registerProvider,
      registerTool,
      prompt,
      history: () => Ref.get(entries),
      events: events.events,
      subscribe: events.subscribe,
    } satisfies Runtime;
  },
);

export const Runtime: { readonly make: () => Effect.Effect<Runtime> } = {
  make: makeRuntime,
};
