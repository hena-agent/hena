import type { AgentError } from "./common";

export const errorFromUnknown = (
  cause: unknown,
  options: { readonly signal?: AbortSignal } = {},
): AgentError => {
  const isAbortError = (): boolean =>
    cause instanceof Error && cause.name === "AbortError";

  const category =
    options.signal?.aborted === true || isAbortError() ? "aborted" : "unknown";
  if (cause instanceof Error) {
    return { category, message: cause.message };
  }
  if (typeof cause === "string") {
    return { category, message: cause };
  }
  return { category, message: "Unknown error" };
};
