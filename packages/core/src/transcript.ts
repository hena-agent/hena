import type {
  AgentError,
  StopReason,
  TokenUsage,
  ToolCall,
  ToolOutput,
} from "./common";
import type { ModelMessage, ModelPart } from "./provider";

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

export function toModelMessages(
  transcript: readonly TranscriptEntry[],
): readonly ModelMessage[] {
  return transcript.map(toModelMessage);
}

function toModelMessage(entry: TranscriptEntry): ModelMessage {
  if (entry.role === "user") {
    return { content: entry.content, role: "user" };
  }
  if (entry.role === "tool_result") {
    return {
      content: entry.content.text,
      isError: entry.isError,
      role: "tool",
      toolCallId: entry.toolCallId,
    };
  }
  return { parts: entry.parts, role: "assistant" };
}
