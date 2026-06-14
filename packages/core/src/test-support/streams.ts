import type { ProviderChunk } from "../provider";

export function chunkStream(
  chunks: readonly ProviderChunk[],
): AsyncIterable<ProviderChunk> {
  return makeChunkStream(chunks);
}

async function* makeChunkStream(
  chunks: readonly ProviderChunk[],
): AsyncGenerator<ProviderChunk> {
  await Promise.resolve();
  yield* chunks;
}

export async function* throwingStream(
  error: unknown,
): AsyncGenerator<ProviderChunk> {
  await Promise.resolve();
  if (error instanceof Error) {
    throw error;
  }
  yield { stopReason: "completed", type: "finish" } satisfies ProviderChunk;
}

export async function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    signal.addEventListener(
      "abort",
      () => {
        resolve();
      },
      { once: true },
    );
  });
}
