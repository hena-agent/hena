import { Effect, type Semaphore } from "effect";

import { snapshotModel } from "../model/customModel";
import { switchHarnessModel } from "../model/thinking";
import type { HenaModel, HenaThinkingLevel } from "../model/types";
import { HarnessServiceError, normalizeHarnessError } from "./errors";
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
  runPromise(harness.setModel.bind(harness, snapshotModel(model)));

const setThinkingLevel = (
  harness: HarnessLike,
  level: HenaThinkingLevel,
): Effect.Effect<void, HarnessServiceError> =>
  runPromise(harness.setThinkingLevel.bind(harness, level));

const rollbackModel = (
  harness: HarnessLike,
  previousModel: HenaModel,
  previousThinkingLevel: HenaThinkingLevel,
  originalError: HarnessServiceError,
): Effect.Effect<void, HarnessServiceError> =>
  setModel(harness, previousModel).pipe(
    Effect.andThen(setThinkingLevel(harness, previousThinkingLevel)),
    Effect.matchEffect({
      onFailure: (rollbackError: HarnessServiceError) =>
        Effect.fail(
          new HarnessServiceError({
            code: "invalid_state",
            message: "Model switch failed and rollback failed",
            cause: { originalError, rollbackError },
          }),
        ),
      onSuccess: () => Effect.fail(originalError),
    }),
  );

const applyModelThenThinkingLevel: (
  harness: HarnessLike,
  nextModel: HenaModel,
  thinkingLevel: HenaThinkingLevel,
) => Effect.Effect<void, HarnessServiceError> = Effect.fnUntraced(
  function* (harness, nextModel, thinkingLevel) {
    const previousModel = yield* runSync(() =>
      snapshotModel(harness.getModel()),
    );
    const previousThinkingLevel = yield* runSync(
      harness.getThinkingLevel.bind(harness),
    );
    yield* setModel(harness, nextModel);
    yield* setThinkingLevel(harness, thinkingLevel).pipe(
      Effect.matchEffect({
        onFailure: (error: HarnessServiceError) =>
          rollbackModel(harness, previousModel, previousThinkingLevel, error),
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
  > => {
    const modelSnapshot = snapshotModel(model);
    return semaphore.withPermit(
      switchHarnessModel<HarnessServiceError>(
        {
          getThinkingLevel: () =>
            runSync(harness.getThinkingLevel.bind(harness)),
          applyModelThenThinkingLevel: (
            nextModel: HenaModel,
            thinkingLevel: HenaThinkingLevel,
          ) => applyModelThenThinkingLevel(harness, nextModel, thinkingLevel),
        },
        modelSnapshot,
        requestedLevel,
      ).pipe(Effect.uninterruptible),
    );
  };
