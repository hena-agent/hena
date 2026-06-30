import { assert, it } from "vitest";

import { webUiPackageName } from "./index";

it("exposes the web-ui package name", () => {
  assert.strictEqual(webUiPackageName, "@hena-dev/web-ui");
});
