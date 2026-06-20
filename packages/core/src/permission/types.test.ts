import { assert, it } from "@effect/vitest";

import type { PermissionAskInput, PermissionServiceShape } from "./types";

it("models permission service type shapes", () => {
  const input = {
    sessionID: "session-1",
    permission: "external_directory",
    patterns: ["/outside/*"],
    always: ["/outside/*"],
    metadata: {},
  } satisfies PermissionAskInput;
  const keys = ["ask", "deny", "events", "grant", "list"] satisfies Array<
    keyof PermissionServiceShape
  >;

  assert.strictEqual(input.permission, "external_directory");
  assert.deepStrictEqual(keys, ["ask", "deny", "events", "grant", "list"]);
});
