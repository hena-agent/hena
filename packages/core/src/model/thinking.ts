import * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import type { HenaModel, HenaThinkingLevel } from "./types";

export interface HarnessModelRuntime<E = never> {
  readonly getThinkingLevel: () => Effect.Effect<HenaThinkingLevel>;
  readonly applyModelThenThinkingLevel: (
    model: HenaModel,
    level: HenaThinkingLevel,
  ) => Effect.Effect<void, E>;
}

export interface SwitchHarnessModelResult {
  readonly model: HenaModel;
  readonly thinkingLevel: HenaThinkingLevel;
}

export const resolveThinkingLevel = (
  model: HenaModel,
  level: HenaThinkingLevel,
): HenaThinkingLevel => PiAi.clampThinkingLevel(model, level);

export const switchHarnessModel: <E = never>(
  runtime: HarnessModelRuntime<E>,
  model: HenaModel,
  requestedLevel?: HenaThinkingLevel,
) => Effect.Effect<SwitchHarnessModelResult, E> = Effect.fnUntraced(
  function* (runtime, model, requestedLevel) {
    const currentLevel =
      requestedLevel === undefined
        ? yield* runtime.getThinkingLevel()
        : requestedLevel;
    const thinkingLevel = resolveThinkingLevel(model, currentLevel);

    yield* runtime.applyModelThenThinkingLevel(model, thinkingLevel);

    return { model, thinkingLevel } satisfies SwitchHarnessModelResult;
  },
);
