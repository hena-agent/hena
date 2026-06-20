interface RememberAlwaysGrantInput {
  readonly alwaysGranted: Set<string>;
  readonly capability: string | undefined;
  readonly patterns: ReadonlyArray<string>;
  readonly permission: string;
  readonly sessionID: string;
}

export const permissionKey = (
  sessionID: string,
  permission: string,
  capability: string | undefined,
  pattern: string,
): string =>
  `${sessionID}\u0000${permission}\u0000${capability ?? ""}\u0000${pattern}`;

export const rememberAlwaysGrant = (input: RememberAlwaysGrantInput): void => {
  for (const pattern of input.patterns) {
    input.alwaysGranted.add(
      permissionKey(
        input.sessionID,
        input.permission,
        input.capability,
        pattern,
      ),
    );
  }
};
