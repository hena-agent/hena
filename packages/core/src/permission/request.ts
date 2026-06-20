import type { PermissionRequest } from "./schema";
import type { PermissionAskInput } from "./types";

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
    patterns: input.patterns,
    always: input.always,
    metadata: input.metadata,
  } satisfies PermissionRequest;

  return input.tool === undefined ? request : { ...request, tool: input.tool };
};

export const isAlwaysGranted = (
  alwaysGranted: ReadonlySet<string>,
  input: PermissionAskInput,
): boolean =>
  input.patterns.every((pattern) =>
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
