import { Effect } from "effect";
import { errorFromUnknown } from "../common/error-from-unknown";
import { finishFromError } from "../provider/finish-from-error";
import type { ProviderChunk } from "../provider/provider";
import { singleChunkIterator } from "../provider/single-chunk-iterator";
import type { ProviderStreamFactory } from "./turn-stream";

export const openIterator = (
  stream: ProviderStreamFactory,
  signal: AbortSignal,
): Effect.Effect<AsyncIterator<ProviderChunk>> =>
  Effect.try({
    catch: (cause: unknown) => errorFromUnknown(cause, { signal }),
    try: () => stream()[Symbol.asyncIterator](),
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(singleChunkIterator(finishFromError(error))),
    ),
  );
