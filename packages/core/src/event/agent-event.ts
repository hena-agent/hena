import { Schema } from "effect";

import {
  RunEndEvent,
  RunStartEvent,
  TurnEndEvent,
  TurnStartEvent,
} from "./lifecycle";
import {
  MessageEndEvent,
  MessageStartEvent,
  ReasoningDeltaEvent,
  ReasoningEndEvent,
  ReasoningStartEvent,
  TextDeltaEvent,
  TextEndEvent,
  TextStartEvent,
} from "./message";
import { DiagnosticEvent, ErrorEvent, UsageEvent } from "./terminal";
import {
  ToolCallEvent,
  ToolExecutionDeltaEvent,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
  ToolInputDeltaEvent,
  ToolInputEndEvent,
  ToolInputStartEvent,
  ToolResultEvent,
} from "./tool";

export const AgentEvent = Schema.Union([
  RunStartEvent,
  RunEndEvent,
  TurnStartEvent,
  TurnEndEvent,
  MessageStartEvent,
  MessageEndEvent,
  TextStartEvent,
  TextDeltaEvent,
  TextEndEvent,
  ReasoningStartEvent,
  ReasoningDeltaEvent,
  ReasoningEndEvent,
  ToolInputStartEvent,
  ToolInputDeltaEvent,
  ToolInputEndEvent,
  ToolCallEvent,
  ToolExecutionStartEvent,
  ToolExecutionDeltaEvent,
  ToolExecutionEndEvent,
  ToolResultEvent,
  UsageEvent,
  DiagnosticEvent,
  ErrorEvent,
]).annotate({ identifier: "AgentEvent" });
export type AgentEvent = Schema.Schema.Type<typeof AgentEvent>;
