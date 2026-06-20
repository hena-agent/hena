import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import {
  maxSearchScannedEntries,
  selectDirectoryEntries,
} from "./directoryEntryBounds";
import { makeFileSearchCollector } from "./fileSearchCollector";
import type {
  FileSearchOptions,
  FileSearchVisitDirectory,
  FileSearchVisitEntry,
} from "./fileSearchTypes";

const authorizedPath = Effect.fnUntraced(function* (
  options: FileSearchOptions,
  path: string,
) {
  if (options.authorize === undefined) {
    return path;
  }
  const authorization = yield* options.authorize(path);
  return authorization.canonicalPath;
});

export const searchFiles = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  pathService: EffectPath.Path,
  root: string,
  options: FileSearchOptions,
) {
  const rootInfo = yield* fs.stat(root);
  const collector = makeFileSearchCollector(options);
  const visitedDirectories = new Set<string>();
  let scannedEntries = 0;

  const visitDirectory: FileSearchVisitDirectory = Effect.fnUntraced(
    function* (directory, prefix) {
      const canonicalDir = yield* authorizedPath(options, directory);
      if (visitedDirectories.has(canonicalDir)) {
        return;
      }
      visitedDirectories.add(canonicalDir);
      const directoryEntries = selectDirectoryEntries(
        yield* fs.readDirectory(canonicalDir),
      );
      if (directoryEntries.truncated) {
        collector.markTruncated();
      }
      const entries = [...directoryEntries.entries].sort((left, right) =>
        left.localeCompare(right),
      );

      for (const entry of entries) {
        if (collector.full || scannedEntries >= maxSearchScannedEntries) {
          collector.markTruncated();
          return;
        }
        scannedEntries += 1;
        yield* visitEntry(canonicalDir, prefix, entry);
      }
    },
  );

  const visitEntry: FileSearchVisitEntry = Effect.fnUntraced(
    function* (directory, prefix, entry) {
      const fullPath = pathService.join(directory, entry);
      const relativePath =
        prefix === "" ? entry : pathService.join(prefix, entry);
      const statPath = yield* authorizedPath(options, fullPath);
      const info = yield* fs.stat(statPath);

      if (info.type === "File") {
        if (!collector.matches(statPath, relativePath)) {
          return;
        }
        collector.add(statPath);
        return;
      }
      if (info.type === "Directory") {
        yield* visitDirectory(statPath, relativePath);
      }
    },
  );

  if (rootInfo.type === "File") {
    if (collector.matches(root, pathService.basename(root))) {
      const canonicalPath = yield* authorizedPath(options, root);
      collector.add(canonicalPath);
    }
    return collector.result();
  }
  if (rootInfo.type !== "Directory") {
    return collector.result();
  }

  yield* visitDirectory(root, "");
  return collector.result();
});
