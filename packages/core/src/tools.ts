import type { ToolOutput } from "./common";

type JsonSchema = {
  readonly type?: string;
};

type StandardIssue = {
  readonly message?: string;
};

export type StandardResult =
  | { readonly value: unknown }
  | { readonly issues: readonly StandardIssue[] };

export type StandardSchema = {
  readonly "~standard": {
    readonly validate: (
      input: unknown,
    ) => Promise<StandardResult> | StandardResult;
  };
};

export type ToolParameters = JsonSchema | StandardSchema;

type ToolContext = {
  readonly sessionId: string;
  readonly signal: AbortSignal;
  readonly toolCallId: string;
  readonly update: (partial: ToolOutput) => Promise<void>;
};

export type Tool = {
  readonly description: string;
  readonly execute: (
    input: unknown,
    context: ToolContext,
  ) => Promise<ToolOutput> | ToolOutput;
  readonly name: string;
  readonly parameters: ToolParameters;
};

export type ToolDefinition = {
  readonly description: string;
  readonly name: string;
  readonly parameters: ToolParameters;
};

export function toolDefinition(tool: Tool): ToolDefinition {
  return {
    description: tool.description,
    name: tool.name,
    parameters: tool.parameters,
  };
}

export function isStandardSchema(
  schema: ToolParameters,
): schema is StandardSchema {
  return "~standard" in schema;
}
