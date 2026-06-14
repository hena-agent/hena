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

type ToolBase = {
  readonly description: string;
  readonly execute: (
    input: unknown,
    context: ToolContext,
  ) => Promise<ToolOutput> | ToolOutput;
  readonly name: string;
};

export type Tool = ToolBase &
  (
    | {
        readonly parameters: JsonSchema;
        readonly schema?: JsonSchema;
      }
    | {
        readonly parameters: StandardSchema;
        readonly schema: JsonSchema;
      }
  );

export type ToolDefinition = {
  readonly description: string;
  readonly name: string;
  readonly parameters: JsonSchema;
};

export function toolDefinition(tool: Tool): ToolDefinition {
  return {
    description: tool.description,
    name: tool.name,
    parameters: providerParameters(tool),
  };
}

function providerParameters(tool: Tool): JsonSchema {
  const parameters = tool.parameters;
  if (!isStandardSchema(parameters)) {
    return tool.schema ?? parameters;
  }
  if (tool.schema === undefined) {
    throw new Error(
      `Standard-schema tool requires provider schema: ${tool.name}`,
    );
  }
  return tool.schema;
}

export function isStandardSchema(
  schema: ToolParameters,
): schema is StandardSchema {
  return "~standard" in schema;
}
