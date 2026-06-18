import { assert, it } from "@effect/vitest";

import { appPackageName } from "./index";

it("exposes the app package name", () => {
  assert.strictEqual(appPackageName, "@hena-dev/app");
});
