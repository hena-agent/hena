import type { ProviderChunk } from "./provider";

export const singleChunkIterator = (
  chunk: ProviderChunk,
): AsyncIterator<ProviderChunk> =>
  (async function* () {
    await Promise.resolve();
    yield chunk;
  })()[Symbol.asyncIterator]();
