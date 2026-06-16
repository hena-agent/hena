import { type Effect, Schema } from "effect";

import type { Message } from "../domain/message";
import {
  JsonValue,
  type RunId,
  type SessionId,
  type ToolCallId,
  type ToolName,
} from "../domain/primitives";
import type { ToolExecutionError } from "../error/agent-error";

export const ToolStreamChunk = JsonValue.annotate({
  identifier: "ToolStreamChunk",
});
export type ToolStreamChunk = Schema.Schema.Type<typeof ToolStreamChunk>;

export const ToolResult = Schema.Struct({
  output: JsonValue,
  isError: Schema.Boolean,
}).annotate({ identifier: "ToolResult" });
export interface ToolResult<Output extends JsonValue = JsonValue> {
  readonly output: Output;
  readonly isError: boolean;
}

export interface ToolContext {
  readonly sessionId: SessionId;
  readonly runId: RunId;
  readonly toolCallId: ToolCallId;
  readonly signal: AbortSignal;
  readonly messages: ReadonlyArray<Message>;
  readonly emit: (chunk: ToolStreamChunk) => Effect.Effect<void>;
}

export interface Tool<Parameters, Output extends JsonValue = JsonValue> {
  readonly name: ToolName;
  readonly description: string;
  readonly parameters: Schema.Schema<Parameters>;
  readonly execute: (
    args: Parameters,
    ctx: ToolContext,
  ) => Effect.Effect<ToolResult<Output>, ToolExecutionError>;
}
