import type {
  AgentError,
  StopReason,
  TokenUsage,
  ToolCall,
  ToolOutput,
} from "../common/common";
import type { ModelPart } from "../provider/provider";

export type UserEntry = {
  readonly content: string;
  readonly id: string;
  readonly role: "user";
  readonly source: "prompt";
  readonly timestamp: string;
};

export type AssistantPart = ModelPart;

export type AssistantEntry = {
  readonly error: AgentError | undefined;
  readonly id: string;
  readonly parts: readonly AssistantPart[];
  readonly role: "assistant";
  readonly stopReason: StopReason;
  readonly timestamp: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: TokenUsage | undefined;
};

export type ToolResultEntry = {
  readonly content: ToolOutput;
  readonly id: string;
  readonly isError: boolean;
  readonly role: "tool_result";
  readonly timestamp: string;
  readonly toolCallId: string;
  readonly toolName: string;
};

export type TranscriptEntry = UserEntry | AssistantEntry | ToolResultEntry;
