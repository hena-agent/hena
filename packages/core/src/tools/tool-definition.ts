import { isStandardSchema } from "./is-standard-schema";
import type { JsonSchema, StandardSchema, Tool, ToolDefinition } from "./tools";

export const toolDefinition = (tool: Tool): ToolDefinition => {
  const isStandardSchemaTool = (
    value: Tool,
  ): value is Tool & {
    readonly parameters: StandardSchema;
    readonly schema: JsonSchema;
  } => isStandardSchema(value.parameters);

  const providerParameters = (value: Tool): JsonSchema => {
    if (isStandardSchemaTool(value)) {
      return value.schema;
    }
    return value.schema ?? value.parameters;
  };

  return {
    description: tool.description,
    name: tool.name,
    parameters: providerParameters(tool),
  };
};
