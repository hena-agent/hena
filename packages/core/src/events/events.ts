import type {
  StopReason,
  TokenUsage,
  ToolCall,
  ToolOutput,
} from "../common/common";
import type {
  AssistantEntry,
  ToolResultEntry,
  UserEntry,
} from "../transcript/transcript";

type EventEnvelope = {
  readonly schemaVersion: 1;
  readonly sequence: number;
  readonly sessionId: string;
  readonly timestamp: string;
};

export type EventPayload =
  | { readonly entry: UserEntry; readonly type: "user_message" }
  | { readonly type: "agent_start" }
  | { readonly type: "turn_start" }
  | { readonly type: "message_start" }
  | { readonly text: string; readonly type: "message_delta" }
  | { readonly entry: AssistantEntry; readonly type: "message_end" }
  | { readonly toolCall: ToolCall; readonly type: "tool_start" }
  | {
      readonly partial: ToolOutput;
      readonly toolCallId: string;
      readonly type: "tool_update";
    }
  | { readonly entry: ToolResultEntry; readonly type: "tool_end" }
  | { readonly type: "turn_end"; readonly usage: TokenUsage | undefined }
  | { readonly reason: StopReason; readonly type: "agent_end" };

export type CoreEvent = EventEnvelope & EventPayload;

export type CoreEventType = CoreEvent["type"];
