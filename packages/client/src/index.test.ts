import { expect, test } from "vitest";

import { clientPackageName } from "./client";

test("exposes the client package name", () => {
  expect(clientPackageName).toBe("@hena-dev/client");
});
