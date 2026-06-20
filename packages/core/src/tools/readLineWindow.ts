import { type Effect, FileSystem, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { boundUtf8Text } from "./textBounds";

const maxReadOutputBytes = Number(FileSystem.MiB(1));

export interface ReadWindow {
  readonly bytes: number;
  readonly lines: ReadonlyArray<string>;
  readonly totalLines: number;
  readonly truncated: boolean;
}

const initialWindow = (): ReadWindow => ({
  bytes: 0,
  lines: [],
  totalLines: 0,
  truncated: false,
});

const appendWindowLine = (
  state: ReadWindow,
  line: string,
  offset: number,
  limit: number,
): ReadWindow => {
  const totalLines = state.totalLines + 1;
  if (state.truncated && state.bytes >= maxReadOutputBytes) {
    return { ...state, totalLines };
  }
  if (totalLines < offset) {
    return { ...state, totalLines };
  }
  if (state.lines.length >= limit) {
    return { ...state, totalLines, truncated: true };
  }
  const remaining = maxReadOutputBytes - state.bytes;
  const bounded = boundUtf8Text(line, remaining);
  return {
    bytes: state.bytes + Math.min(bounded.bytes, remaining),
    lines: [...state.lines, bounded.text],
    totalLines,
    truncated: state.truncated || bounded.truncated,
  };
};

export const readLineWindow = (
  fs: FileSystem.FileSystem,
  path: string,
  offset: number,
  limit: number,
): Effect.Effect<ReadWindow, PlatformError> =>
  fs.stream(path).pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.runFold(initialWindow, (state, line) =>
      appendWindowLine(state, line, offset, limit),
    ),
  );
