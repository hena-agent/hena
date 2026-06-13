import { expect, test } from "vitest";

import { corePackageName } from "./index";

test("exposes the core package name", () => {
  expect(corePackageName).toBe("@hena-dev/core");
});
