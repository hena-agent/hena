import type { PermissionRequest } from "./schema";
import type { PermissionAskInput } from "./types";

const snapshotMetadataValue = (value: unknown): unknown => {
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

export const permissionKey = (
  sessionID: string,
  permission: string,
  pattern: string,
): string => `${sessionID}\u0000${permission}\u0000${pattern}`;

export const makeRequest = (
  id: string,
  input: PermissionAskInput,
): PermissionRequest => {
  const request = {
    id,
    sessionID: input.sessionID,
    permission: input.permission,
    patterns: [...input.patterns],
    always: [...input.always],
    metadata: snapshotMetadata(input.metadata),
  } satisfies PermissionRequest;

  return input.tool === undefined ? request : { ...request, tool: input.tool };
};

export const snapshotPermissionRequest = (
  request: PermissionRequest,
): PermissionRequest => {
  const snapshot = {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.permission,
    patterns: [...request.patterns],
    always: [...request.always],
    metadata: snapshotMetadata(request.metadata),
  } satisfies PermissionRequest;

  return request.tool === undefined
    ? snapshot
    : { ...snapshot, tool: request.tool };
};

export const isAlwaysGranted = (
  alwaysGranted: ReadonlySet<string>,
  input: PermissionAskInput,
): boolean =>
  input.always.length > 0 &&
  input.always.every((pattern) =>
    alwaysGranted.has(
      permissionKey(input.sessionID, input.permission, pattern),
    ),
  );

export const rememberAlwaysGrant = (
  alwaysGranted: Set<string>,
  sessionID: string,
  permission: string,
  patterns: ReadonlyArray<string>,
): void => {
  for (const pattern of patterns) {
    alwaysGranted.add(permissionKey(sessionID, permission, pattern));
  }
};
