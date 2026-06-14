import type {
  AgentError,
  StopReason,
  TokenUsage,
  ToolCall,
  ToolOutput,
} from "./common";
import { errorFromUnknown } from "./common";
import type { CoreEvent, CoreEventType, EventPayload } from "./events";
import type { EventObserver, Extension, ExtensionAPI } from "./extension";
import type {
  ModelMessage,
  ModelPart,
  Provider,
  ProviderChunk,
  ProviderRequest,
} from "./provider";
import {
  type CreateRuntimeOptions,
  createRuntime,
  type HenaRuntime,
} from "./runtime";
import type { Session } from "./session";
import type {
  JsonSchema,
  Tool,
  ToolContext,
  ToolDefinition,
  ToolParameters,
} from "./tools";
import type {
  AssistantEntry,
  AssistantPart,
  ToolResultEntry,
  TranscriptEntry,
  UserEntry,
} from "./transcript";

export const corePackageName = "@hena-dev/core";

export type {
  AgentError,
  AssistantEntry,
  AssistantPart,
  CoreEvent,
  CoreEventType,
  CreateRuntimeOptions,
  EventObserver,
  EventPayload,
  Extension,
  ExtensionAPI,
  HenaRuntime,
  JsonSchema,
  ModelMessage,
  ModelPart,
  Provider,
  ProviderChunk,
  ProviderRequest,
  Session,
  StopReason,
  TokenUsage,
  Tool,
  ToolCall,
  ToolContext,
  ToolDefinition,
  ToolOutput,
  ToolParameters,
  ToolResultEntry,
  TranscriptEntry,
  UserEntry,
};
export { createRuntime, errorFromUnknown };
