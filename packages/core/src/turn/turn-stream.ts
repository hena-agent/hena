import type {
  AgentError,
  StopReason,
  TokenUsage,
  ToolCall,
} from "../common/common";
import type { ProviderChunk } from "../provider/provider";
import type { AssistantPart } from "../transcript/transcript";

export type TurnAccumulator = {
  error: AgentError | undefined;
  readonly parts: AssistantPart[];
  stopReason: StopReason;
  readonly toolCalls: ToolCall[];
  usage: TokenUsage | undefined;
};

export type ProviderStreamFactory = () => AsyncIterable<ProviderChunk>;
