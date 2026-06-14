import type { JsonSchema } from "../tools/tools";
import { isRecord } from "./is-record";
import type { SchemaValidator } from "./schema-validator";
import { validateProperties } from "./validate-properties";

export const validateObjectRules = (
  validate: SchemaValidator,
  schema: JsonSchema,
  value: unknown,
  path: string,
): string | undefined => {
  if (!isRecord(value)) {
    return `${path} must be object`;
  }
  const missing = schema.required?.find((key) => !(key in value));
  if (missing !== undefined) {
    return `${path}.${missing} is required`;
  }
  return validateProperties(validate, schema, value, path);
};
