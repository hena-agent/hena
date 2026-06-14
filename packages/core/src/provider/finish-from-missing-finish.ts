import type { ProviderChunk } from "./provider";

export const finishFromMissingFinish = (): ProviderChunk => ({
  error: {
    category: "api",
    message: "Provider stream ended without a finish chunk",
  },
  stopReason: "error",
  type: "finish",
});
