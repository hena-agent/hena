import type {
  AgentError,
  StopReason,
  TokenUsage,
  ToolCall,
  ToolOutput,
} from "./common/common";
import type { CoreEvent, CoreEventType, EventPayload } from "./events/events";
import type {
  EventObserver,
  Extension,
  ExtensionAPI,
} from "./extensions/extension";
import type {
  ModelMessage,
  ModelPart,
  Provider,
  ProviderChunk,
  ProviderRequest,
} from "./provider/provider";
import { createRuntime } from "./runtime/create-runtime";
import type { CreateRuntimeOptions, HenaRuntime } from "./runtime/runtime";
import type { Session } from "./session/session";
import type {
  JsonSchema,
  Tool,
  ToolContext,
  ToolDefinition,
  ToolParameters,
} from "./tools/tools";
import type {
  AssistantEntry,
  AssistantPart,
  ToolResultEntry,
  TranscriptEntry,
  UserEntry,
} from "./transcript/transcript";

export const corePackageName = "@hena-dev/core";

// Curated public facade for @hena-dev/core; internal modules should avoid
// barrel re-exports and import from their source modules directly.
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
export { createRuntime };
