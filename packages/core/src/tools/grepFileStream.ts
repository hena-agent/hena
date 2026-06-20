import { Effect, type FileSystem, Stream } from "effect";
import type { PlatformError } from "effect/PlatformError";
import {
  collectGrepScannedBytes,
  type GrepCollectionState,
} from "./grepMatchCollector";
import type { GrepResult } from "./grepOperations";
import {
  finishGrepStream,
  type GrepStreamContext,
  makeGrepStreamContext,
  processGrepText,
} from "./grepStreamState";

export interface GrepFileStreamInput {
  readonly file: string;
  readonly fs: FileSystem.FileSystem;
  readonly limit: number;
  readonly pattern: RegExp;
  readonly scanState?: GrepCollectionState | undefined;
}

const trackScanBytes = (
  state: GrepCollectionState | undefined,
  context: GrepStreamContext,
  chunk: Uint8Array,
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (
      state !== undefined &&
      !collectGrepScannedBytes(state, chunk.byteLength)
    ) {
      context.state.truncated = true;
      context.state.done = true;
    }
  });

export const grepFileStream = (
  input: GrepFileStreamInput,
): Effect.Effect<GrepResult, PlatformError> => {
  const { file, fs, limit, pattern, scanState } = input;
  const context = makeGrepStreamContext(pattern, file, limit);
  return fs.stream(file).pipe(
    Stream.tap((chunk) => trackScanBytes(scanState, context, chunk)),
    Stream.takeUntil((): boolean => context.state.done),
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
