import type { ToolOutput } from "./common";

export type JsonSchema = {
  readonly additionalProperties?: boolean | JsonSchema;
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly items?: JsonSchema;
  readonly properties?: { readonly [key: string]: JsonSchema };
  readonly required?: readonly string[];
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

export type ToolContext = {
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
  readonly schema?: JsonSchema;
};

export type ToolDefinition = {
  readonly description: string;
  readonly name: string;
  readonly parameters: JsonSchema;
};

export function toolDefinition(tool: Tool): ToolDefinition {
  return {
    description: tool.description,
    name: tool.name,
    parameters: tool.schema ?? providerSchema(tool.parameters),
  };
}

function providerSchema(parameters: ToolParameters): JsonSchema {
  if (isStandardSchema(parameters)) {
    return { type: "object" };
  }
  return parameters;
}

export function isStandardSchema(
  schema: ToolParameters,
): schema is StandardSchema {
  return "~standard" in schema;
}
