import { Effect } from "effect";
import type { ProviderChunk } from "./provider";

const ABORTED_STREAM_CLEANUP_GRACE_MS = 10;

export function closeProviderIterator(
  iterator: AsyncIterator<ProviderChunk>,
  signal: AbortSignal,
): Effect.Effect<void> {
  return Effect.promise(async () => {
    try {
      const cleanup = iterator.return?.();
      if (signal.aborted) {
        await Promise.race([
          Promise.resolve(cleanup).then(
            () => undefined,
            () => undefined,
          ),
          delay(ABORTED_STREAM_CLEANUP_GRACE_MS),
        ]);
        return undefined;
      }
      await cleanup;
    } catch {
      return undefined;
    }
  });
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
