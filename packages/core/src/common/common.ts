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
