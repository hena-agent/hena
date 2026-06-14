import type { AgentError } from "../common/common";
import type { ProviderChunk } from "./provider";

export const finishFromError = (error: AgentError): ProviderChunk => {
  if (error.category === "aborted") {
    return { stopReason: "aborted", type: "finish" };
  }
  return { error, stopReason: "error", type: "finish" };
};
