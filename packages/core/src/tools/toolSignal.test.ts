import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { raceAbortSignal } from "./toolSignal";

it.effect("interrupts immediately for pre-aborted signals", () =>
  Effect.gen(function* () {
    const controller = new AbortController();
    controller.abort();
    const exit = yield* raceAbortSignal(Effect.never, controller.signal).pipe(
      Effect.exit,
    );

    assert.strictEqual(exit._tag, "Failure");
  }),
);
