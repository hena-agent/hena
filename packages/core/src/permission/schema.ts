import { Schema } from "effect";

import { ToolRef } from "../toolRef";

export const PermissionID = Schema.String.check(Schema.isStartsWith("per-"));

export const PermissionMetadata = Schema.Record(Schema.String, Schema.Json);

export type PermissionMetadata = Schema.Schema.Type<typeof PermissionMetadata>;

export const PermissionRequest = Schema.Struct({
  id: PermissionID,
  sessionID: Schema.String,
  permission: Schema.String,
  patterns: Schema.Array(Schema.String),
  always: Schema.Array(Schema.String),
  metadata: PermissionMetadata,
  tool: Schema.optional(ToolRef),
});

export type PermissionRequest = Schema.Schema.Type<typeof PermissionRequest>;

const PermissionGrantScope = Schema.Literals(["once", "always"]);

export const PermissionGrant = Schema.Struct({
  requestID: PermissionID,
  scope: PermissionGrantScope,
});

export type PermissionGrant = Schema.Schema.Type<typeof PermissionGrant>;

export const PermissionDeny = Schema.Struct({
  requestID: PermissionID,
  message: Schema.optional(Schema.String),
});

export type PermissionDeny = Schema.Schema.Type<typeof PermissionDeny>;

export const PermissionAskedEvent = Schema.Struct({
  type: Schema.Literal("permission.asked"),
  request: PermissionRequest,
});

export type PermissionAskedEvent = Schema.Schema.Type<
  typeof PermissionAskedEvent
>;

export const PermissionGrantedEvent = Schema.Struct({
  type: Schema.Literal("permission.granted"),
  requestID: PermissionID,
  scope: PermissionGrantScope,
  patterns: Schema.Array(Schema.String),
});

export type PermissionGrantedEvent = Schema.Schema.Type<
  typeof PermissionGrantedEvent
>;

export const PermissionDeniedEvent = Schema.Struct({
  type: Schema.Literal("permission.denied"),
  requestID: PermissionID,
  message: Schema.String,
});

export type PermissionDeniedEvent = Schema.Schema.Type<
  typeof PermissionDeniedEvent
>;

export const PermissionEvent = Schema.Union([
  PermissionAskedEvent,
  PermissionGrantedEvent,
  PermissionDeniedEvent,
]);

export type PermissionEvent = Schema.Schema.Type<typeof PermissionEvent>;

export class PermissionDeniedError extends Schema.TaggedErrorClass<PermissionDeniedError>()(
  "PermissionDenied",
  { requestID: PermissionID, message: Schema.String },
) {}

export class PermissionRequestNotFound extends Schema.TaggedErrorClass<PermissionRequestNotFound>()(
  "PermissionRequestNotFound",
  { requestID: PermissionID },
) {}
