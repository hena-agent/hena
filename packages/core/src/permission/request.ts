import type { Schema } from "effect";

import { permissionKey } from "./grantKey";
import type { PermissionRequest } from "./schema";
import type { PermissionAskInput } from "./types";

type PermissionTool = NonNullable<PermissionRequest["tool"]>;

const snapshotTool = (tool: PermissionTool): PermissionTool => ({ ...tool });

const snapshotMetadataValue = (value: Schema.Json): Schema.Json => {
  if (Array.isArray(value)) {
    return value.map(snapshotMetadataValue);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      snapshotMetadataValue(child),
    ]),
  );
};

const snapshotMetadata = (
  metadata: PermissionAskInput["metadata"],
): PermissionAskInput["metadata"] =>
  Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      snapshotMetadataValue(value),
    ]),
  );

export const makeRequest = (
  id: string,
  input: PermissionAskInput,
): PermissionRequest => {
  const request = {
    id,
    sessionID: input.sessionID,
    permission: input.permission,
    ...(input.capability === undefined ? {} : { capability: input.capability }),
    patterns: [...input.patterns],
    always: [...input.always],
    metadata: snapshotMetadata(input.metadata),
  } satisfies PermissionRequest;

  return input.tool === undefined
    ? request
    : { ...request, tool: snapshotTool(input.tool) };
};

export const snapshotPermissionRequest = (
  request: PermissionRequest,
): PermissionRequest => {
  const snapshot = {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.permission,
    ...(request.capability === undefined
      ? {}
      : { capability: request.capability }),
    patterns: [...request.patterns],
    always: [...request.always],
    metadata: snapshotMetadata(request.metadata),
  } satisfies PermissionRequest;

  return request.tool === undefined
    ? snapshot
    : { ...snapshot, tool: snapshotTool(request.tool) };
};

export const isAlwaysGranted = (
  alwaysGranted: ReadonlySet<string>,
  input: PermissionAskInput,
): boolean =>
  input.always.length > 0 &&
  input.always.every((pattern) =>
    alwaysGranted.has(
      permissionKey(
        input.sessionID,
        input.permission,
        input.capability,
        pattern,
      ),
    ),
  );
