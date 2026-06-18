import { assert, it } from "@effect/vitest";

import { desktopPackageName } from "./index";

it("exposes the desktop package name", () => {
  assert.strictEqual(desktopPackageName, "@hena-dev/desktop");
});
