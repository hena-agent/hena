import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { Tool } from "effect/unstable/ai";

import { makeToolkit } from "./toolkit";

it.effect("uses an unreachable handler because core resolves tools", () =>
  Effect.gen(function* () {
    const tool = Tool.make("x");
    const toolkit = makeToolkit([
      { handler: () => Effect.succeed("x"), name: "x", tool },
    ]);
    const handled = toolkit.handle("x", {});

    assert.strictEqual(Effect.isEffect(handled), true);
  }),
);
