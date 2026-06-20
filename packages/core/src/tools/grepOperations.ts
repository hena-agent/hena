import { Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { compileGlobEffect } from "./globMatch";
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

const maxGrepFileBytes = FileSystem.MiB(1);

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
    const info = yield* fs.stat(file);
    if (info.size > maxGrepFileBytes) {
      return { matches: [], truncated: true };
    }
    const text = yield* fs.readFileString(file);
    const matches: Array<GrepMatch> = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!pattern.test(line)) {
        continue;
      }
      if (matches.length >= limit) {
        return { matches, truncated: true };
      }
      matches.push({ path: file, line: index + 1, text: line });
    }
    return { matches, truncated: false };
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

export const formatMatches = (matches: ReadonlyArray<GrepMatch>): string => {
  const output: Array<string> = [];
  let current = "";
  for (const match of matches) {
    if (current !== match.path) {
      current = match.path;
      output.push(`${match.path}:`);
    }
    output.push(`  Line ${match.line}: ${match.text}`);
  }
  return output.join("\n");
};
