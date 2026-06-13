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

export function errorFromUnknown(cause: unknown): AgentError {
  if (cause instanceof Error) {
    return { category: "unknown", message: cause.message };
  }
  if (typeof cause === "string") {
    return { category: "unknown", message: cause };
  }
  return { category: "unknown", message: "Unknown error" };
}
