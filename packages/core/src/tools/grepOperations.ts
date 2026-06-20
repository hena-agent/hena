import { Effect, type FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { compileGlobEffect } from "./globMatch";
import { grepFileStream } from "./grepFileStream";
import type { ToolInputError } from "./toolErrors";

export interface GrepMatch {
  readonly path: string;
  readonly line: number;
  readonly text: string;
}

export interface GrepResult {
  readonly matches: ReadonlyArray<GrepMatch>;
  readonly truncated: boolean;
}

type IncludeMatcher = (relativePath: string, basename: string) => boolean;

export const makeIncludeMatcher: (
  include?: string,
) => Effect.Effect<IncludeMatcher, ToolInputError> = Effect.fnUntraced(
  function* (include) {
    if (include === undefined) {
      return (): boolean => true;
    }
    const matches = yield* compileGlobEffect(include);
    return (relativePath: string, basename: string): boolean =>
      matches(relativePath) || matches(basename);
  },
);

export const grepFile: (
  fs: FileSystem.FileSystem,
  pattern: RegExp,
  file: string,
  limit: number,
) => Effect.Effect<GrepResult, PlatformError> = Effect.fnUntraced(
  function* (fs, pattern, file, limit) {
    return yield* grepFileStream(fs, pattern, file, limit);
  },
);

export const grepFiles = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  pattern: RegExp,
  files: ReadonlyArray<string>,
  limit: number,
) {
  const matches: Array<GrepMatch> = [];
  let truncated = false;
  for (const file of files) {
    if (matches.length >= limit) {
      return { matches, truncated: true } satisfies GrepResult;
    }
    const result = yield* grepFile(fs, pattern, file, limit - matches.length);
    matches.push(...result.matches);
    if (result.truncated) {
      truncated = true;
      if (matches.length >= limit) {
        return { matches, truncated } satisfies GrepResult;
      }
    }
  }
  return { matches, truncated } satisfies GrepResult;
});
