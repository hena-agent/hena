import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

import { corePackageName, corePackageNameEffect } from "./index";

it("exposes the core package name", () => {
  expect(corePackageName).toBe("@hena-dev/core");
});

it.effect("yields the core package name as an Effect", () =>
  Effect.gen(function* () {
    expect(yield* corePackageNameEffect).toBe("@hena-dev/core");
  }),
);
