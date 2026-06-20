import { Effect, type FileSystem } from "effect";

const maxDirectoryEntries = 10000;
export const maxSearchScannedEntries = 50000;

export interface BoundedDirectoryEntries {
  readonly entries: ReadonlyArray<string>;
  readonly truncated: boolean;
}

const selectDirectoryEntries = (
  entries: ReadonlyArray<string>,
): BoundedDirectoryEntries => ({
  entries: entries.slice(0, maxDirectoryEntries),
  truncated: entries.length > maxDirectoryEntries,
});

export const readBoundedDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
) {
  return selectDirectoryEntries(yield* fs.readDirectory(path));
});
