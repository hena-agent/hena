const maxDirectoryEntries = 10000;
export const maxSearchScannedEntries = 50000;

export interface BoundedDirectoryEntries {
  readonly entries: ReadonlyArray<string>;
  readonly truncated: boolean;
}

export const selectDirectoryEntries = (
  entries: ReadonlyArray<string>,
): BoundedDirectoryEntries => ({
  entries: entries.slice(0, maxDirectoryEntries),
  truncated: entries.length > maxDirectoryEntries,
});
