import { Effect } from "effect";

export {
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

export { AgentEvent, AgentEventSchemas } from "./event/agent-event";

export {
  LifecycleEvents,
  RunEndEvent,
  RunStartEvent,
  TurnEndEvent,
  TurnStartEvent,
} from "./event/lifecycle";

export {
  MessageEndEvent,
  MessageEvents,
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
  TerminalEvents,
  UsageEvent,
} from "./event/terminal";

export {
  ToolCallEvent,
  ToolEvents,
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
