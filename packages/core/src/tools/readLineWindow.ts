import { Effect, type FileSystem, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { finishWindow, processText } from "./readLineWindowProcess";
import { makeReadWindowState, type ReadWindow } from "./readLineWindowState";

export type { ReadWindow } from "./readLineWindowState";

export const readLineWindow = (
  fs: FileSystem.FileSystem,
  path: string,
  offset: number,
  limit: number,
): Effect.Effect<ReadWindow, PlatformError> => {
  const decoder = new TextDecoder();
  const state = makeReadWindowState();
  return fs.stream(path).pipe(
    Stream.tap((chunk) =>
      Effect.sync(() => {
        processText(
          state,
          decoder.decode(chunk, { stream: true }),
          offset,
          limit,
        );
      }),
    ),
    Stream.takeUntil((): boolean => state.done),
    Stream.runDrain,
    Effect.andThen(
      Effect.sync(() => finishWindow(state, decoder, offset, limit)),
    ),
  );
};
