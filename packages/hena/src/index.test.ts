import { assert, it } from "@effect/vitest";

import { henaPackageName } from "./index";

it("exposes the hena package name", () => {
  assert.strictEqual(henaPackageName, "@hena-dev/hena");
});
