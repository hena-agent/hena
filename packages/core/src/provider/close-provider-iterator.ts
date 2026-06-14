import { Effect } from "effect";
import { withCleanupGrace } from "../common/with-cleanup-grace";
import type { ProviderChunk } from "./provider";

export const closeProviderIterator = (
  iterator: AsyncIterator<ProviderChunk>,
  signal: AbortSignal,
): Effect.Effect<void> => {
  const ignoreCleanupFailure = async (
    cleanup: Promise<IteratorResult<ProviderChunk>> | undefined,
  ): Promise<void> => {
    try {
      await cleanup;
    } catch {
      return undefined;
    }
  };

  return Effect.promise(async () => {
    try {
      const cleanup = iterator.return?.();
      if (signal.aborted) {
        await withCleanupGrace(ignoreCleanupFailure(cleanup), undefined);
        return undefined;
      }
      await cleanup;
    } catch {
      return undefined;
    }
  });
};
