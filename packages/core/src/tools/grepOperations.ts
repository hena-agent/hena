import { Effect, type FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { compileGlobEffect } from "./globMatch";
import { grepFileStream } from "./grepFileStream";
import {
  collectGrepMatches,
  type GrepCollectionState,
  isGrepScanBudgetExhausted,
  makeGrepCollectionState,
} from "./grepMatchCollector";
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

export interface GrepFileInput {
  readonly file: string;
  readonly fs: FileSystem.FileSystem;
  readonly limit: number;
  readonly pattern: RegExp;
  readonly scanState?: GrepCollectionState | undefined;
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
  input: GrepFileInput,
) => Effect.Effect<GrepResult, PlatformError> = Effect.fnUntraced(
  function* (input) {
    return yield* grepFileStream(input);
  },
);

const isGrepComplete = (
  matches: ReadonlyArray<GrepMatch>,
  limit: number,
  state: GrepCollectionState,
): boolean => matches.length >= limit || isGrepScanBudgetExhausted(state);

export const grepFiles = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  pattern: RegExp,
  files: ReadonlyArray<string>,
  limit: number,
) {
  const matches: Array<GrepMatch> = [];
  const state = makeGrepCollectionState();
  let truncated = false;
  for (const file of files) {
    if (isGrepComplete(matches, limit, state)) {
      return { matches, truncated: true } satisfies GrepResult;
    }
    const result = yield* grepFile({
      fs,
      pattern,
      file,
      limit: limit - matches.length,
      scanState: state,
    });
    const collected = collectGrepMatches(matches, state, result.matches);
    truncated = truncated || result.truncated || !collected;
    if (!collected || isGrepComplete(matches, limit, state)) {
      return { matches, truncated: true } satisfies GrepResult;
    }
  }
  return { matches, truncated } satisfies GrepResult;
});
