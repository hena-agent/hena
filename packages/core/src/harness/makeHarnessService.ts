import { Effect, Semaphore } from "effect";

import { type HarnessServiceError, normalizeHarnessError } from "./errors";
import { makeSwitchModelOperation } from "./switchModelOperation";
import type { HarnessLike, HarnessServiceShape } from "./types";

type Args<Method extends keyof HarnessLike> = Parameters<HarnessLike[Method]>;

const runPromise = <A>(
  run: () => PromiseLike<A>,
): Effect.Effect<A, HarnessServiceError> =>
  Effect.tryPromise({ try: run, catch: normalizeHarnessError });

const runSync = <A>(run: () => A): Effect.Effect<A> => Effect.sync(run);

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

    return {
      prompt: (...args: Args<"prompt">) =>
        runStructural(harness.prompt.bind(harness, ...args)),
      skill: (...args: Args<"skill">) =>
        runStructural(harness.skill.bind(harness, ...args)),
      promptFromTemplate: (...args: Args<"promptFromTemplate">) =>
        runStructural(harness.promptFromTemplate.bind(harness, ...args)),
      steer: (...args: Args<"steer">) =>
        runPromise(harness.steer.bind(harness, ...args)),
      followUp: (...args: Args<"followUp">) =>
        runPromise(harness.followUp.bind(harness, ...args)),
      nextTurn: (...args: Args<"nextTurn">) =>
        runPromise(harness.nextTurn.bind(harness, ...args)),
      abort: () => runPromise(harness.abort.bind(harness)),
      compact: (instructions?: string) =>
        mutate(harness.compact.bind(harness, instructions)),
      navigateTree: (...args: Args<"navigateTree">) =>
        mutate(harness.navigateTree.bind(harness, ...args)),
      getModel: () => runSync(harness.getModel.bind(harness)),
      setModel: (...args: Args<"setModel">) =>
        mutate(harness.setModel.bind(harness, ...args)),
      getThinkingLevel: () => runSync(harness.getThinkingLevel.bind(harness)),
      setThinkingLevel: (...args: Args<"setThinkingLevel">) =>
        mutate(harness.setThinkingLevel.bind(harness, ...args)),
      getTools: () => runSync(harness.getTools.bind(harness)),
      setTools: (...args: Args<"setTools">) =>
        mutate(harness.setTools.bind(harness, ...args)),
      getActiveTools: () => runSync(harness.getActiveTools.bind(harness)),
      setActiveTools: (...args: Args<"setActiveTools">) =>
        mutate(harness.setActiveTools.bind(harness, ...args)),
      getSteeringMode: () => runSync(harness.getSteeringMode.bind(harness)),
      setSteeringMode: (...args: Args<"setSteeringMode">) =>
        mutate(harness.setSteeringMode.bind(harness, ...args)),
      getFollowUpMode: () => runSync(harness.getFollowUpMode.bind(harness)),
      setFollowUpMode: (...args: Args<"setFollowUpMode">) =>
        mutate(harness.setFollowUpMode.bind(harness, ...args)),
      getResources: () => runSync(harness.getResources.bind(harness)),
      setResources: (...args: Args<"setResources">) =>
        mutate(harness.setResources.bind(harness, ...args)),
      getStreamOptions: () => runSync(harness.getStreamOptions.bind(harness)),
      setStreamOptions: (...args: Args<"setStreamOptions">) =>
        mutate(harness.setStreamOptions.bind(harness, ...args)),
      switchModel: makeSwitchModelOperation(semaphore, harness),
    } satisfies HarnessServiceShape;
  },
);
