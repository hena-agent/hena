import type { StandardSchema, ToolParameters } from "./tools";

export const isStandardSchema = (
  schema: ToolParameters,
): schema is StandardSchema => "~standard" in schema;
