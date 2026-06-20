import { Effect, type FileSystem, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";

import type { GrepResult } from "./grepOperations";
import {
  finishGrepStream,
  makeGrepStreamContext,
  processGrepText,
} from "./grepStreamState";

export const grepFileStream = (
  fs: FileSystem.FileSystem,
  pattern: RegExp,
  file: string,
  limit: number,
): Effect.Effect<GrepResult, PlatformError> => {
  const context = makeGrepStreamContext(pattern, file, limit);
  return fs.stream(file).pipe(
    Stream.decodeText,
    Stream.tap((text) =>
      Effect.sync(() => {
        processGrepText(context, text);
      }),
    ),
    Stream.takeUntil((): boolean => context.state.done),
    Stream.runDrain,
    Effect.andThen(Effect.sync(() => finishGrepStream(context))),
  );
};
