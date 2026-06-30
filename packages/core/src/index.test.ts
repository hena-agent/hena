import { assert, it } from "vitest";

import { corePackageName } from "./index";

it("exposes the core package name", () => {
  assert.strictEqual(corePackageName, "@hena-dev/core");
});
