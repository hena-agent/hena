import { assert, it } from "@effect/vitest";

import { cliPackageName } from "./index";

it("exposes the cli package name", () => {
  assert.strictEqual(cliPackageName, "@hena-dev/cli");
});
