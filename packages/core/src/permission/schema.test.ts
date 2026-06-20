import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  PermissionAskedEvent,
  PermissionDeniedError,
  PermissionDeniedEvent,
  PermissionEvent,
  PermissionGrant,
  PermissionGrantedEvent,
  PermissionRequest,
  PermissionRequestNotFound,
} from "./schema";

it("decodes permission request and event DTOs", () => {
  const request = Schema.decodeUnknownSync(PermissionRequest)({
    id: "per-1",
    sessionID: "session-1",
    permission: "external_directory",
    capability: "read",
    patterns: ["/outside/*"],
    always: ["/outside/*"],
    metadata: { filepath: "/outside/file.txt", parentDir: "/outside" },
    tool: { callID: "call-1" },
  });
  const asked = Schema.decodeUnknownSync(PermissionAskedEvent)({
    type: "permission.asked",
    request,
  });
  const grant = Schema.decodeUnknownSync(PermissionGrant)({
    requestID: request.id,
    scope: "always",
  });
  const granted = Schema.decodeUnknownSync(PermissionGrantedEvent)({
    type: "permission.granted",
    requestID: request.id,
    scope: grant.scope,
    patterns: request.always,
  });
  const denied = Schema.decodeUnknownSync(PermissionDeniedEvent)({
    type: "permission.denied",
    requestID: request.id,
    message: "Not allowed",
  });
  const event = Schema.decodeUnknownSync(PermissionEvent)(granted);

  assert.strictEqual(asked.request.tool?.callID, "call-1");
  assert.strictEqual(asked.request.capability, "read");
  assert.deepStrictEqual(asked.request.metadata, {
    filepath: "/outside/file.txt",
    parentDir: "/outside",
  });
  assert.strictEqual(event.type, "permission.granted");
  assert.strictEqual(denied.message, "Not allowed");
});

it("rejects non-JSON permission metadata", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(PermissionRequest)({
      id: "per-1",
      sessionID: "session-1",
      permission: "external_directory",
      capability: "read",
      patterns: ["/outside/*"],
      always: ["/outside/*"],
      metadata: { value: 1n },
    }),
  );
});

it("models permission service errors", () => {
  const denied = new PermissionDeniedError({
    requestID: "per-1",
    message: "No",
  });
  const missing = new PermissionRequestNotFound({ requestID: "per-missing" });

  assert.strictEqual(denied._tag, "PermissionDenied");
  assert.strictEqual(denied.requestID, "per-1");
  assert.strictEqual(missing._tag, "PermissionRequestNotFound");
  assert.strictEqual(missing.requestID, "per-missing");
});
