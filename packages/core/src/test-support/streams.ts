import type { ProviderChunk } from "../provider/provider";

export const chunkStream = (
  chunks: readonly ProviderChunk[],
): AsyncIterable<ProviderChunk> => makeChunkStream(chunks);

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

export const waitForAbort = async (signal: AbortSignal): Promise<void> => {
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
};
