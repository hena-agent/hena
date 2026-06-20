import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import { makeFileSearchCollector } from "./fileSearchCollector";
import type {
  FileSearchOptions,
  FileSearchResult,
  FileSearchVisitDirectory,
  FileSearchVisitEntry,
} from "./fileSearchTypes";
import type { ToolExecutionError } from "./schema";

const authorizedPath = Effect.fnUntraced(function* (
  options: FileSearchOptions,
  path: string,
  kind: "directory" | "file",
) {
  if (options.authorize === undefined) {
    return path;
  }
  const authorization = yield* options.authorize(path, kind);
  return authorization.canonicalPath;
});

export const searchFiles: (
  fs: FileSystem.FileSystem,
  pathService: EffectPath.Path,
  root: string,
  options: FileSearchOptions,
) => Effect.Effect<FileSearchResult, ToolExecutionError> = Effect.fnUntraced(
  function* (fs, pathService, root, options) {
    const rootInfo = yield* fs.stat(root);
    const collector = makeFileSearchCollector(options);
    const visitedDirectories = new Set<string>();

    const visitDirectory: FileSearchVisitDirectory = Effect.fnUntraced(
      function* (directory, prefix) {
        const canonicalDir = yield* authorizedPath(
          options,
          directory,
          "directory",
        );
        if (visitedDirectories.has(canonicalDir)) {
          return;
        }
        visitedDirectories.add(canonicalDir);
        const entries = [...(yield* fs.readDirectory(canonicalDir))].sort(
          (left, right) => left.localeCompare(right),
        );

        for (const entry of entries) {
          if (collector.truncated) {
            return;
          }
          yield* visitEntry(canonicalDir, prefix, entry);
        }
      },
    );

    const visitEntry: FileSearchVisitEntry = Effect.fnUntraced(
      function* (directory, prefix, entry) {
        const fullPath = pathService.join(directory, entry);
        const relativePath =
          prefix === "" ? entry : pathService.join(prefix, entry);
        const info = yield* fs.stat(fullPath);

        if (info.type === "File") {
          if (!collector.matches(fullPath, relativePath)) {
            return;
          }
          const canonicalPath = yield* authorizedPath(
            options,
            fullPath,
            "file",
          );
          collector.add(canonicalPath);
          return;
        }
        if (info.type === "Directory") {
          yield* visitDirectory(fullPath, relativePath);
        }
      },
    );

    if (rootInfo.type === "File") {
      if (collector.matches(root, pathService.basename(root))) {
        const canonicalPath = yield* authorizedPath(options, root, "file");
        collector.add(canonicalPath);
      }
      return collector.result();
    }
    if (rootInfo.type !== "Directory") {
      return collector.result();
    }

    yield* visitDirectory(root, "");
    return collector.result();
  },
);
