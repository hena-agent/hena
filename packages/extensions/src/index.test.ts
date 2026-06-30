import { assert, it } from "vitest";

import { extensionsPackageName } from "./index";

it("exposes the extensions package name", () => {
  assert.strictEqual(extensionsPackageName, "@hena-dev/extensions");
});
