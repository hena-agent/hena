import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { PermissionID, PermissionRequest, PermissionTool } from "./schema";

it("accepts only per-prefixed permission ids", () => {
  assert.strictEqual(Schema.decodeUnknownSync(PermissionID)("per-1"), "per-1");
  assert.throws(() => Schema.decodeUnknownSync(PermissionID)("req-1"));
});

it("preserves permission tool message and call ids", () => {
  const tool = Schema.decodeUnknownSync(PermissionTool)({
    messageID: "msg-1",
    callID: "call-1",
  });
  const request = Schema.decodeUnknownSync(PermissionRequest)({
    id: "per-1",
    sessionID: "session-1",
    permission: "external_directory",
    patterns: ["/outside/*"],
    always: ["/outside/*"],
    metadata: {},
    tool,
  });

  assert.deepStrictEqual(tool, { messageID: "msg-1", callID: "call-1" });
  assert.deepStrictEqual(request.tool, {
    messageID: "msg-1",
    callID: "call-1",
  });
});
