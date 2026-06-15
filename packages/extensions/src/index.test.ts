import { assert, it } from "@effect/vitest";

import { extensionsPackageName } from "./index";

it("exposes the extensions package name", () => {
  assert.strictEqual(extensionsPackageName, "@hena-dev/extensions");
});
