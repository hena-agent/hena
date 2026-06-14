import type { JsonSchema } from "../tools/tools";

export const hasObjectRules = (schema: JsonSchema): boolean =>
  schema.properties !== undefined ||
  schema.required !== undefined ||
  schema.additionalProperties !== undefined;
