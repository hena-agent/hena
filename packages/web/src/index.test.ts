import { assert, it } from "@effect/vitest";

import { webPackageName } from "./index";

it("exposes the web package name", () => {
  assert.strictEqual(webPackageName, "@hena-dev/web");
});
