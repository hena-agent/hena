import { Effect, type Semaphore } from "effect";

import { switchHarnessModel } from "../model/thinking";
import type { HenaModel, HenaThinkingLevel } from "../model/types";
import { type HarnessServiceError, normalizeHarnessError } from "./errors";
import type { HarnessLike, HarnessServiceShape } from "./types";

const runPromise = <A>(
  run: () => PromiseLike<A>,
): Effect.Effect<A, HarnessServiceError> =>
  Effect.tryPromise({ try: run, catch: normalizeHarnessError });

const runSync = <A>(run: () => A): Effect.Effect<A> => Effect.sync(run);

const setModel = (
  harness: HarnessLike,
  model: HenaModel,
): Effect.Effect<void, HarnessServiceError> =>
  runPromise(harness.setModel.bind(harness, model));

const setThinkingLevel = (
  harness: HarnessLike,
  level: HenaThinkingLevel,
): Effect.Effect<void, HarnessServiceError> =>
  runPromise(harness.setThinkingLevel.bind(harness, level));

const applyModelThenThinkingLevel: (
  harness: HarnessLike,
  nextModel: HenaModel,
  thinkingLevel: HenaThinkingLevel,
) => Effect.Effect<void, HarnessServiceError> = Effect.fnUntraced(
  function* (harness, nextModel, thinkingLevel) {
    const previousModel = yield* runSync(harness.getModel.bind(harness));
    yield* setModel(harness, nextModel);
    yield* setThinkingLevel(harness, thinkingLevel).pipe(
      Effect.matchEffect({
        onFailure: (error: HarnessServiceError) =>
          setModel(harness, previousModel).pipe(
            Effect.ignore,
            Effect.andThen(Effect.fail(error)),
          ),
        onSuccess: () => Effect.void,
      }),
    );
  },
);

export const makeSwitchModelOperation =
  (
    semaphore: Semaphore.Semaphore,
    harness: HarnessLike,
  ): HarnessServiceShape["switchModel"] =>
  (
    model: HenaModel,
    requestedLevel?: HenaThinkingLevel,
  ): Effect.Effect<
    { readonly model: HenaModel; readonly thinkingLevel: HenaThinkingLevel },
    HarnessServiceError
  > =>
    semaphore.withPermit(
      switchHarnessModel<HarnessServiceError>(
        {
          getThinkingLevel: () =>
            runSync(harness.getThinkingLevel.bind(harness)),
          applyModelThenThinkingLevel: (
            nextModel: HenaModel,
            thinkingLevel: HenaThinkingLevel,
          ) => applyModelThenThinkingLevel(harness, nextModel, thinkingLevel),
        },
        model,
        requestedLevel,
      ).pipe(Effect.uninterruptible),
    );
