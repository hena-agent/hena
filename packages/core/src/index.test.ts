import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { corePackageName, corePackageNameEffect } from "./index";

it("exposes the core package name", () => {
  assert.strictEqual(corePackageName, "@hena-dev/core");
});

it.effect("yields the core package name as an Effect", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* corePackageNameEffect, "@hena-dev/core");
  }),
);
