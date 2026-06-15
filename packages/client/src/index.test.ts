import { assert, it } from "@effect/vitest";

import { clientPackageName } from "./index";

it("exposes the client package name", () => {
  assert.strictEqual(clientPackageName, "@hena-dev/client");
});
