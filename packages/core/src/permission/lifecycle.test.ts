import { assert, it } from "@effect/vitest";

import { denyRequest } from "./lifecycle";
import { makeRequest } from "./request";

it("builds a permission denial settlement", () => {
  const request = makeRequest("per-1", {
    sessionID: "session-1",
    permission: "external_directory",
    patterns: ["/outside/*"],
    always: ["/outside/*"],
    metadata: {},
  });
  const denied = denyRequest(request, "No");

  assert.strictEqual(denied.failure._tag, "PermissionDenied");
  assert.strictEqual(denied.event.type, "permission.denied");
  if (denied.event.type !== "permission.denied") {
    throw new Error("expected permission denial event");
  }
  assert.strictEqual(denied.event.message, "No");
});
