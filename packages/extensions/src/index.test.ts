import { expect, test } from "vitest";

import { extensionsPackageName } from "./index";

test("exposes the extensions package name", () => {
  expect(extensionsPackageName).toBe("@hena-dev/extensions");
});
