import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  type HarnessModelRuntime,
  resolveThinkingLevel,
  switchHarnessModel,
} from "./thinking";

const plainModel = PiAi.getModel("openai", "gpt-4o-mini");
const reasoningModel = {
  ...plainModel,
  id: "reasoner",
  reasoning: true,
  thinkingLevelMap: { xhigh: null },
};

it("clamps requested thinking levels to model support", () => {
  assert.strictEqual(resolveThinkingLevel(plainModel, "high"), "off");
  assert.strictEqual(resolveThinkingLevel(reasoningModel, "xhigh"), "high");
});

it.effect(
  "switches the harness model and clamps its current thinking level",
  () =>
    Effect.gen(function* () {
      const calls: Array<string> = [];
      const runtime: HarnessModelRuntime = {
        getThinkingLevel: () => Effect.succeed("xhigh"),
        applyModelThenThinkingLevel: (model, level) =>
          Effect.sync(() => {
            calls.push(`model:${model.id}`);
            calls.push(`thinking:${level}`);
          }),
      };

      const result = yield* switchHarnessModel(runtime, plainModel);

      assert.deepStrictEqual(calls, ["model:gpt-4o-mini", "thinking:off"]);
      assert.strictEqual(result.thinkingLevel, "off");
    }),
);

it.effect("uses an explicit requested thinking level during model switch", () =>
  Effect.gen(function* () {
    const levels: Array<string> = [];
    const runtime: HarnessModelRuntime = {
      getThinkingLevel: () => Effect.succeed("minimal"),
      applyModelThenThinkingLevel: (_model, level) =>
        Effect.sync(() => {
          levels.push(level);
        }),
    };

    yield* switchHarnessModel(runtime, reasoningModel, "xhigh");

    assert.deepStrictEqual(levels, ["high"]);
  }),
);
