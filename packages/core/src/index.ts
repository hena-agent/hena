import { Effect } from "effect";

export {
  AssistantMessage,
  Message,
  Usage,
} from "./domain/message";

export {
  CustomPart,
  FilePart,
  Part,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "./domain/parts";

export {
  EventSeq,
  JsonValue,
  MediaType,
  MessageId,
  PartId,
  RunId,
  SessionId,
  TimestampMillis,
  TokenCount,
  ToolCallId,
  ToolName,
} from "./domain/primitives";

export {
  AgentError,
  MaxStepsExceeded,
  ProviderError,
  ToolDecodeError,
  ToolExecutionError,
} from "./error/agent-error";

export { AgentEvent } from "./event/agent-event";

export {
  RunEndEvent,
  RunStartEvent,
  TurnEndEvent,
  TurnStartEvent,
} from "./event/lifecycle";

export {
  MessageEndEvent,
  MessageStartEvent,
  ReasoningDeltaEvent,
  ReasoningEndEvent,
  ReasoningStartEvent,
  TextDeltaEvent,
  TextEndEvent,
  TextStartEvent,
} from "./event/message";

export {
  DiagnosticEvent,
  DiagnosticLevel,
  ErrorEvent,
  UsageEvent,
} from "./event/terminal";

export {
  ToolCallEvent,
  ToolExecutionDeltaEvent,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
  ToolInputDeltaEvent,
  ToolInputEndEvent,
  ToolInputStartEvent,
  ToolResultEvent,
} from "./event/tool";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
