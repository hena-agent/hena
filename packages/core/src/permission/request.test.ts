import { assert, it } from "@effect/vitest";

import { permissionKey, rememberAlwaysGrant } from "./grantKey";
import {
  isAlwaysGranted,
  makeRequest,
  snapshotPermissionRequest,
} from "./request";
import type { PermissionAskInput } from "./types";

const input = {
  sessionID: "session-1",
  permission: "external_directory",
  capability: "read",
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

it("snapshots nested permission metadata", () => {
  const metadata = { extra: { tags: ["safe"] } };
  const request = makeRequest("per-1", { ...input, metadata });
  metadata.extra.tags.push("mutated");
  const snapshot = snapshotPermissionRequest(request);
  const extra = snapshot.metadata.extra;
  if (typeof extra !== "object" || extra === null || !("tags" in extra)) {
    throw new Error("expected nested metadata");
  }
  const tags = extra.tags;
  if (!Array.isArray(tags)) {
    throw new Error("expected metadata tags");
  }
  tags.push("changed");

  assert.deepStrictEqual(request.metadata, { extra: { tags: ["safe"] } });
  assert.deepStrictEqual(snapshot.metadata, {
    extra: { tags: ["safe", "changed"] },
  });
});

it("tracks exact always grants by session, permission, capability, and pattern", () => {
  const grants = new Set<string>();

  assert.strictEqual(isAlwaysGranted(grants, input), false);
  rememberAlwaysGrant({
    alwaysGranted: grants,
    capability: input.capability,
    patterns: input.always,
    permission: input.permission,
    sessionID: input.sessionID,
  });

  assert.strictEqual(
    grants.has(
      permissionKey("session-1", "external_directory", "read", "/outside/*"),
    ),
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
  assert.strictEqual(
    isAlwaysGranted(grants, { ...input, capability: "write" }),
    false,
  );
});
