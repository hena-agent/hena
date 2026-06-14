import type { JsonSchema } from "../tools/tools";

export type SchemaValidator = (
  schema: JsonSchema,
  value: unknown,
  path: string,
) => string | undefined;
