import { Context, Schema, type Stream } from "effect";

import { Message } from "../domain/message";
import { JsonValue, ToolName } from "../domain/primitives";
import type { ProviderError } from "../error/agent-error";
import type { ModelStreamPart } from "./model-stream-part";

const AbortSignalSchema = Schema.instanceOf(AbortSignal).annotate({
  identifier: "AbortSignal",
});

export const ToolSpec = Schema.Struct({
  name: ToolName,
  description: Schema.String,
  parameters: JsonValue,
}).annotate({ identifier: "ToolSpec" });
export type ToolSpec = Schema.Schema.Type<typeof ToolSpec>;

export const ToolChoice = Schema.Union([
  Schema.Literals(["auto", "required", "none"]),
  Schema.Struct({ tool: ToolName }),
]).annotate({ identifier: "ToolChoice" });
export type ToolChoice = Schema.Schema.Type<typeof ToolChoice>;

export const ModelRequest = Schema.Struct({
  system: Schema.optionalKey(Schema.String),
  messages: Schema.Array(Message),
  tools: Schema.Array(ToolSpec),
  toolChoice: Schema.optionalKey(ToolChoice),
  signal: AbortSignalSchema,
}).annotate({ identifier: "ModelRequest" });
export type ModelRequest = Schema.Schema.Type<typeof ModelRequest>;

export class LanguageModel extends Context.Service<
  LanguageModel,
  {
    readonly stream: (
      request: ModelRequest,
    ) => Stream.Stream<ModelStreamPart, ProviderError>;
  }
>()("@hena-dev/core/LanguageModel") {}
