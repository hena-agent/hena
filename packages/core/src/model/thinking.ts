import * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import type { HenaModel, HenaThinkingLevel } from "./types";

export interface HarnessModelRuntime<Error = unknown> {
  readonly getThinkingLevel: () => Effect.Effect<HenaThinkingLevel>;
  readonly setModelAndThinkingLevel: (
    model: HenaModel,
    level: HenaThinkingLevel,
  ) => Effect.Effect<void, Error>;
}

export interface SwitchHarnessModelResult {
  readonly model: HenaModel;
  readonly thinkingLevel: HenaThinkingLevel;
}

export const resolveThinkingLevel = (
  model: HenaModel,
  level: HenaThinkingLevel,
): HenaThinkingLevel => PiAi.clampThinkingLevel(model, level);

export const switchHarnessModel: <Error>(
  runtime: HarnessModelRuntime<Error>,
  model: HenaModel,
  requestedLevel?: HenaThinkingLevel,
) => Effect.Effect<SwitchHarnessModelResult, Error> = Effect.fnUntraced(
  function* (runtime, model, requestedLevel) {
    const currentLevel =
      requestedLevel === undefined
        ? yield* runtime.getThinkingLevel()
        : requestedLevel;
    const thinkingLevel = resolveThinkingLevel(model, currentLevel);

    yield* runtime.setModelAndThinkingLevel(model, thinkingLevel);

    return { model, thinkingLevel } satisfies SwitchHarnessModelResult;
  },
);
