import { Effect } from "effect";
import { errorFromUnknown } from "../common/error-from-unknown";
import { raceAbort } from "../common/race-abort";
import { finishFromError } from "../provider/finish-from-error";
import { finishFromMissingFinish } from "../provider/finish-from-missing-finish";
import type { ProviderChunk } from "../provider/provider";

export const readNext = (
  iterator: AsyncIterator<ProviderChunk>,
  signal: AbortSignal,
): Effect.Effect<ProviderChunk> =>
  Effect.tryPromise({
    catch: (cause: unknown) => errorFromUnknown(cause, { signal }),
    try: async (): Promise<IteratorResult<ProviderChunk>> => {
      const result = await raceAbort(async () => {
        const next = await iterator.next();
        return next;
      }, signal);
      return result;
    },
  }).pipe(
    Effect.map(
      (result): ProviderChunk =>
        result.done === true ? finishFromMissingFinish() : result.value,
    ),
    Effect.catch((error) => Effect.succeed(finishFromError(error))),
  );
