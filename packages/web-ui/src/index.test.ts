import { assert, it } from "@effect/vitest";

import { webUiPackageName } from "./index";

it("exposes the web-ui package name", () => {
  assert.strictEqual(webUiPackageName, "@hena-dev/web-ui");
});
