import { Effect, Semaphore } from "effect";

import { type HarnessServiceError, normalizeHarnessError } from "./errors";
import { makeHarnessServiceMethods } from "./serviceMethods";
import type { HarnessLike, HarnessServiceShape } from "./types";

const runPromise = <A>(
  run: () => PromiseLike<A>,
): Effect.Effect<A, HarnessServiceError> =>
  Effect.tryPromise({ try: run, catch: normalizeHarnessError });

const abortOnInterrupt = (harness: HarnessLike): Effect.Effect<void> =>
  runPromise(harness.abort.bind(harness)).pipe(Effect.ignore);

const withInterruptAbort = <A>(
  harness: HarnessLike,
  self: Effect.Effect<A, HarnessServiceError>,
): Effect.Effect<A, HarnessServiceError> =>
  self.pipe(Effect.onInterrupt(() => abortOnInterrupt(harness)));

const structural = <A>(
  semaphore: Semaphore.Semaphore,
  harness: HarnessLike,
  run: () => PromiseLike<A>,
): Effect.Effect<A, HarnessServiceError> =>
  semaphore.withPermit(withInterruptAbort(harness, runPromise(run)));

const nonAbortableStructural = <A>(
  semaphore: Semaphore.Semaphore,
  run: () => PromiseLike<A>,
): Effect.Effect<A, HarnessServiceError> =>
  semaphore.withPermit(runPromise(run).pipe(Effect.uninterruptible));

export const makeHarnessService: (
  harness: HarnessLike,
) => Effect.Effect<HarnessServiceShape> = Effect.fnUntraced(
  function* (harness) {
    const semaphore = yield* Semaphore.make(1);
    const runStructural = <A>(
      run: () => PromiseLike<A>,
    ): Effect.Effect<A, HarnessServiceError> =>
      structural(semaphore, harness, run);
    const mutate = <A>(
      run: () => PromiseLike<A>,
    ): Effect.Effect<A, HarnessServiceError> =>
      nonAbortableStructural(semaphore, run);
    const read = <A>(run: () => A): Effect.Effect<A> =>
      semaphore.withPermit(Effect.sync(run)); // Avoid torn mutable-harness reads.

    return makeHarnessServiceMethods(harness, semaphore, {
      mutate,
      read,
      run: runPromise,
      runStructural,
    });
  },
);
