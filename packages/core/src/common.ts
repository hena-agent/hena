export type StopReason = "completed" | "error" | "aborted" | "max_turns";

type AgentErrorCategory =
  | "aborted"
  | "auth"
  | "rate-limit"
  | "overloaded"
  | "context-overflow"
  | "output-length"
  | "network"
  | "api"
  | "unknown";

export type AgentError = {
  readonly category: AgentErrorCategory;
  readonly message: string;
};

export type TokenUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type ToolCall = {
  readonly id: string;
  readonly input: unknown;
  readonly name: string;
};

export type ToolOutput = {
  readonly text: string;
  readonly type: "text";
};

export function errorFromUnknown(
  cause: unknown,
  options: { readonly signal?: AbortSignal } = {},
): AgentError {
  const category =
    options.signal?.aborted === true || isAbortError(cause)
      ? "aborted"
      : "unknown";
  if (cause instanceof Error) {
    return { category, message: cause.message };
  }
  if (typeof cause === "string") {
    return { category, message: cause };
  }
  return { category, message: "Unknown error" };
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}
