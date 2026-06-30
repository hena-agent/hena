import { assert, it } from "vitest";

import { clientPackageName } from "./index";

it("exposes the client package name", () => {
  assert.strictEqual(clientPackageName, "@hena-dev/client");
});
