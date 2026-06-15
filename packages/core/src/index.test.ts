import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeRuntime } from "./index";

it.effect("exposes a runtime constructor", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    assert.deepStrictEqual(yield* runtime.systemPrompt.sections, []);
  }),
);
