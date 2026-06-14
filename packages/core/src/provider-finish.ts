import type { AgentError } from "./common";
import type { ProviderChunk } from "./provider";

export function finishFromError(error: AgentError): ProviderChunk {
  if (error.category === "aborted") {
    return { stopReason: "aborted", type: "finish" };
  }
  return { error, stopReason: "error", type: "finish" };
}

export function finishFromMissingFinish(): ProviderChunk {
  return {
    error: {
      category: "api",
      message: "Provider stream ended without a finish chunk",
    },
    stopReason: "error",
    type: "finish",
  };
}

export function singleChunkIterator(
  chunk: ProviderChunk,
): AsyncIterator<ProviderChunk> {
  return (async function* () {
    await Promise.resolve();
    yield chunk;
  })()[Symbol.asyncIterator]();
}
