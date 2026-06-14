import type { AgentError, TokenUsage, ToolCall } from "./common";
import type { ToolDefinition } from "./tools";

export type ModelPart =
  | { readonly text: string; readonly type: "text" }
  | { readonly toolCall: ToolCall; readonly type: "tool_call" };

export type ModelMessage =
  | { readonly content: string; readonly role: "user" }
  | { readonly parts: readonly ModelPart[]; readonly role: "assistant" }
  | {
      readonly content: string;
      readonly isError: boolean;
      readonly role: "tool";
      readonly toolCallId: string;
    };

export type ProviderRequest = {
  readonly messages: readonly ModelMessage[];
  readonly signal: AbortSignal;
  readonly tools: readonly ToolDefinition[];
};

export type ProviderChunk =
  | { readonly text: string; readonly type: "text_delta" }
  | { readonly toolCall: ToolCall; readonly type: "tool_call" }
  | {
      readonly stopReason: "aborted" | "completed";
      readonly type: "finish";
      readonly usage?: TokenUsage;
    }
  | {
      readonly error: AgentError;
      readonly stopReason: "error";
      readonly type: "finish";
      readonly usage?: TokenUsage;
    };

export type Provider = {
  readonly stream: (request: ProviderRequest) => AsyncIterable<ProviderChunk>;
};
