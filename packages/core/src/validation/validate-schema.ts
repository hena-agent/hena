import type { JsonSchema } from "../tools/tools";
import { hasObjectRules } from "./has-object-rules";
import type { SchemaValidator } from "./schema-validator";
import { validateArrayItems } from "./validate-array-items";
import { validateObjectRules } from "./validate-object-rules";
import { validateType } from "./validate-type";

export const validateSchema: SchemaValidator = (
  schema: JsonSchema,
  value: unknown,
  path: string,
): string | undefined => {
  const typeError = validateType(schema, value, path);
  if (typeError !== undefined) {
    return typeError;
  }
  if (
    schema.enum !== undefined &&
    !schema.enum.some((item) => item === value)
  ) {
    return `${path} must be one of the allowed values`;
  }
  if (schema.items !== undefined && Array.isArray(value)) {
    return validateArrayItems(validateSchema, schema.items, value, path);
  }
  if (hasObjectRules(schema)) {
    return validateObjectRules(validateSchema, schema, value, path);
  }
  return undefined;
};
