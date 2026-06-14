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
  if (isStandardSchemaTool(tool)) {
    return tool.schema;
  }
  return tool.schema ?? tool.parameters;
}

function isStandardSchemaTool(tool: Tool): tool is Tool & {
  readonly parameters: StandardSchema;
  readonly schema: JsonSchema;
} {
  return isStandardSchema(tool.parameters);
}

export function isStandardSchema(
  schema: ToolParameters,
): schema is StandardSchema {
  return "~standard" in schema;
}
