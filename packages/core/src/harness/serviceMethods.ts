// biome-ignore-all lint/nursery/useExplicitType: HarnessServiceShape constrains each adapter method.
import type { Effect, Semaphore } from "effect";

import type { HarnessServiceError } from "./errors";
import * as HarnessSnapshots from "./snapshots";
import { makeSwitchModelOperation } from "./switchModelOperation";
import type { HarnessLike, HarnessServiceShape } from "./types";

type Args<Method extends keyof HarnessLike> = Parameters<HarnessLike[Method]>;

interface HarnessMethodRunners {
  readonly mutate: <A>(
    run: () => PromiseLike<A>,
  ) => Effect.Effect<A, HarnessServiceError>;
  readonly read: <A>(run: () => A) => Effect.Effect<A>;
  readonly run: <A>(
    run: () => PromiseLike<A>,
  ) => Effect.Effect<A, HarnessServiceError>;
  readonly runStructural: <A>(
    run: () => PromiseLike<A>,
  ) => Effect.Effect<A, HarnessServiceError>;
}

export const makeHarnessServiceMethods = (
  harness: HarnessLike,
  semaphore: Semaphore.Semaphore,
  runners: HarnessMethodRunners,
): HarnessServiceShape => ({
  prompt: (...args: Args<"prompt">) =>
    runners.runStructural(harness.prompt.bind(harness, ...args)),
  skill: (...args: Args<"skill">) =>
    runners.runStructural(harness.skill.bind(harness, ...args)),
  promptFromTemplate: (...args: Args<"promptFromTemplate">) =>
    runners.runStructural(harness.promptFromTemplate.bind(harness, ...args)),
  steer: (...args: Args<"steer">) =>
    runners.run(harness.steer.bind(harness, ...args)),
  followUp: (...args: Args<"followUp">) =>
    runners.run(harness.followUp.bind(harness, ...args)),
  nextTurn: (...args: Args<"nextTurn">) =>
    runners.runStructural(harness.nextTurn.bind(harness, ...args)),
  abort: () => runners.run(harness.abort.bind(harness)),
  compact: (instructions?: string) =>
    runners.mutate(harness.compact.bind(harness, instructions)),
  navigateTree: (...args: Args<"navigateTree">) =>
    runners.mutate(harness.navigateTree.bind(harness, ...args)),
  getModel: () => runners.read(harness.getModel.bind(harness)),
  setModel: (...args: Args<"setModel">) =>
    runners.mutate(harness.setModel.bind(harness, ...args)),
  getThinkingLevel: () => runners.read(harness.getThinkingLevel.bind(harness)),
  setThinkingLevel: (...args: Args<"setThinkingLevel">) =>
    runners.mutate(harness.setThinkingLevel.bind(harness, ...args)),
  getTools: () =>
    runners.read(() => HarnessSnapshots.snapshotTools(harness.getTools())),
  setTools: (...args: Args<"setTools">) =>
    runners.mutate(harness.setTools.bind(harness, ...args)),
  getActiveTools: () =>
    runners.read(() =>
      HarnessSnapshots.snapshotTools(harness.getActiveTools()),
    ),
  setActiveTools: (...args: Args<"setActiveTools">) =>
    runners.mutate(harness.setActiveTools.bind(harness, ...args)),
  getSteeringMode: () => runners.read(harness.getSteeringMode.bind(harness)),
  setSteeringMode: (...args: Args<"setSteeringMode">) =>
    runners.mutate(harness.setSteeringMode.bind(harness, ...args)),
  getFollowUpMode: () => runners.read(harness.getFollowUpMode.bind(harness)),
  setFollowUpMode: (...args: Args<"setFollowUpMode">) =>
    runners.mutate(harness.setFollowUpMode.bind(harness, ...args)),
  getResources: () =>
    runners.read(() =>
      HarnessSnapshots.snapshotResources(harness.getResources()),
    ),
  setResources: (...args: Args<"setResources">) =>
    runners.mutate(harness.setResources.bind(harness, ...args)),
  getStreamOptions: () =>
    runners.read(() =>
      HarnessSnapshots.snapshotStreamOptions(harness.getStreamOptions()),
    ),
  setStreamOptions: (...args: Args<"setStreamOptions">) =>
    runners.mutate(harness.setStreamOptions.bind(harness, ...args)),
  switchModel: makeSwitchModelOperation(semaphore, harness),
});
