import { assert, it } from "@effect/vitest";

import { serverPackageName } from "./index";

it("exposes the server package name", () => {
  assert.strictEqual(serverPackageName, "@hena-dev/server");
});
