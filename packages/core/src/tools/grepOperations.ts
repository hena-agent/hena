import { Effect, type FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { compileGlobEffect } from "./globMatch";
import { readLineWindow } from "./readLineWindow";
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
    const window = yield* readLineWindow(fs, file, 1, Number.MAX_SAFE_INTEGER);
    const matches: Array<GrepMatch> = [];
    for (const [index, line] of window.lines.entries()) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) {
        continue;
      }
      if (matches.length >= limit) {
        return { matches, truncated: true };
      }
      matches.push({ path: file, line: index + 1, text: line });
    }
    return { matches, truncated: window.truncated };
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
