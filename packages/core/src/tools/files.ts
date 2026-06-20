import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import { makeFileSearchCollector } from "./fileSearchCollector";
import type {
  FileSearchOptions,
  FileSearchResult,
  FileSearchTargetKind,
} from "./fileSearchTypes";

const authorizedPath = Effect.fnUntraced(function* (
  options: FileSearchOptions,
  path: string,
  kind: FileSearchTargetKind,
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
) => Effect.Effect<FileSearchResult, unknown> = Effect.fnUntraced(
  function* (fs, pathService, root, options) {
    const rootInfo = yield* fs.stat(root);
    const collector = makeFileSearchCollector(options);

    const visitDirectory: (
      directory: string,
      prefix: string,
    ) => Effect.Effect<void, unknown> = Effect.fnUntraced(function* (
      directory: string,
      prefix: string,
    ) {
      const entries = [...(yield* fs.readDirectory(directory))].sort(
        (left, right) => left.localeCompare(right),
      );

      for (const entry of entries) {
        if (collector.truncated) {
          return;
        }
        yield* visitEntry(directory, prefix, entry);
      }
    });

    const visitEntry: (
      directory: string,
      prefix: string,
      entry: string,
    ) => Effect.Effect<void, unknown> = Effect.fnUntraced(function* (
      directory: string,
      prefix: string,
      entry: string,
    ) {
      const fullPath = pathService.join(directory, entry);
      const relativePath =
        prefix === "" ? entry : pathService.join(prefix, entry);
      const info = yield* fs.stat(fullPath);

      if (info.type === "File") {
        const canonicalPath = yield* authorizedPath(options, fullPath, "file");
        collector.add(canonicalPath, relativePath);
        return;
      }
      if (info.type === "Directory") {
        const canonicalPath = yield* authorizedPath(
          options,
          fullPath,
          "directory",
        );
        yield* visitDirectory(canonicalPath, relativePath);
      }
    });

    if (rootInfo.type === "File") {
      collector.add(root, pathService.basename(root));
      return collector.result();
    }
    if (rootInfo.type !== "Directory") {
      return collector.result();
    }

    yield* visitDirectory(root, "");
    return collector.result();
  },
);
