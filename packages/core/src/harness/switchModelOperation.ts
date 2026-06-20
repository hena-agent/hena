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
          setModelAndThinkingLevel: (
            nextModel: HenaModel,
            thinkingLevel: HenaThinkingLevel,
          ) =>
            runPromise(harness.setModel.bind(harness, nextModel)).pipe(
              Effect.andThen(
                runPromise(
                  harness.setThinkingLevel.bind(harness, thinkingLevel),
                ),
              ),
            ),
        },
        model,
        requestedLevel,
      ).pipe(Effect.uninterruptible),
    );
