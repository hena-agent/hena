import { Effect, Ref, type Schema, type Stream } from "effect";
import type { LanguageModel, Prompt } from "effect/unstable/ai";

import type { RuntimeError } from "./errors";
import {
  makeEventLog,
  RuntimeEvent,
  type RuntimeEvent as RuntimeEventValue,
} from "./events";
import { getProvider, runLoop } from "./loop";
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
  ) => Effect.Effect<void, RuntimeError>;
  readonly history: () => Effect.Effect<ReadonlyArray<Prompt.Message>>;
  readonly events: () => Effect.Effect<ReadonlyArray<RuntimeEventValue>>;
  readonly subscribe: () => Stream.Stream<RuntimeEventValue>;
}

const makeRuntime: () => Effect.Effect<Runtime> = Effect.fnUntraced(
  function* () {
    const entries = yield* Ref.make<ReadonlyArray<Prompt.Message>>([]);
    const events = yield* makeEventLog;
    const registry = yield* makeRegistry;
    const sessionStarted = yield* Ref.make(false);
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
    const prompt: (
      message: Prompt.Message,
    ) => Effect.Effect<void, RuntimeError> = Effect.fnUntraced(
      function* (message) {
        const snapshot = yield* Ref.get(entries);
        const run = Effect.gen(function* () {
          yield* getProvider(registry);
          const isFirstPrompt = yield* Ref.modify(sessionStarted, (started) => [
            !started,
            true,
          ]);

          if (isFirstPrompt) {
            yield* events.publish(RuntimeEvent.sessionStart());
          }
          yield* appendEntry(entries, message);
          yield* runLoop({ entries, events, registry }, 1);
        });

        return yield* Effect.tapError(run, (error) =>
          Effect.gen(function* () {
            yield* Ref.set(entries, snapshot);
            yield* events.publish(RuntimeEvent.error(error));
          }),
        ).pipe(Effect.ensuring(events.publish(RuntimeEvent.idle())));
      },
    );

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
