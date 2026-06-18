import { assert, it } from "@effect/vitest";

import { dbPackageName } from "./index";

it("exposes the db package name", () => {
  assert.strictEqual(dbPackageName, "@hena-dev/db");
});
