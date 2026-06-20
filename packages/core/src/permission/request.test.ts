import { assert, it } from "@effect/vitest";

import {
  isAlwaysGranted,
  makeRequest,
  permissionKey,
  rememberAlwaysGrant,
} from "./request";
import type { PermissionAskInput } from "./types";

const input = {
  sessionID: "session-1",
  permission: "external_directory",
  patterns: ["/outside/*"],
  always: ["/outside/*"],
  metadata: {},
} satisfies PermissionAskInput;

it("builds permission requests with optional tool details", () => {
  const withoutTool = makeRequest("per-1", input);
  const withTool = makeRequest("per-2", {
    ...input,
    tool: { callID: "call-1" },
  });

  assert.strictEqual("tool" in withoutTool, false);
  assert.strictEqual(withTool.tool?.callID, "call-1");
});

it("tracks exact always grants by session, permission, and pattern", () => {
  const grants = new Set<string>();

  assert.strictEqual(isAlwaysGranted(grants, input), false);
  rememberAlwaysGrant(grants, input.sessionID, input.permission, input.always);

  assert.strictEqual(
    grants.has(permissionKey("session-1", "external_directory", "/outside/*")),
    true,
  );
  assert.strictEqual(isAlwaysGranted(grants, input), true);
  assert.strictEqual(
    isAlwaysGranted(grants, { ...input, sessionID: "session-2" }),
    false,
  );
  assert.strictEqual(
    isAlwaysGranted(grants, { ...input, permission: "other_permission" }),
    false,
  );
});
