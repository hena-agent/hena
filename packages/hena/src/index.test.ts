import { expect, test } from "vitest";

import { henaPackageName } from "./index";

test("exposes the hena package name", () => {
  expect(henaPackageName).toBe("@hena-dev/hena");
});
