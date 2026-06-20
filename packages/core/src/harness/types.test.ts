import type * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import type { HarnessServiceShape } from "./types";

const model: PiAi.Model<PiAi.Api> = {
  id: "model",
  name: "Model",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://example.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 4_096,
};

it.effect("models harness service shape types", () =>
  Effect.gen(function* () {
    const service: Pick<HarnessServiceShape, "getModel" | "setModel"> = {
      getModel: () => Effect.succeed(model),
      setModel: () => Effect.succeed(void 0),
    };

    yield* service.setModel(model);
    assert.strictEqual(yield* service.getModel(), model);
  }),
);
