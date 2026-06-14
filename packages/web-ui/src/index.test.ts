import { expect, test } from "vitest";

import { webUiPackageName } from "./web-ui";

test("exposes the web-ui package name", () => {
  expect(webUiPackageName).toBe("@hena-dev/web-ui");
});
